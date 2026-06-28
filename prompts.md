# Session Prompts — App-Room

อ่าน CLAUDE.md และ design.md ก่อนทำงานทุก session

---

## Session 1: Project Setup + SheetSetup.gs

```
อ่าน CLAUDE.md และ design.md ก่อน

งาน Session 1: สร้าง project structure และ SheetSetup.gs

1. สร้าง folder src/
2. สร้าง src/appsscript.json (webapp config, execute as Me, anyone can access)
3. สร้าง src/SheetSetup.gs — function setupSheets() ที่รันครั้งเดียวเพื่อ:
   - สร้าง Sheet "ตั้งค่า": ใส่ราคาน้ำ/ไฟแต่ละตึก (C, R) และรายชื่อห้องทั้ง 46 ห้องพร้อม
     ค่าเช่าทดสอบ (สลับ 2000/5000) และค่าเฟอร์นิเจอร์ 0 ทุกห้อง
   - สร้าง Sheet "บันทึก": ใส่ header ทุก column ตาม design.md (21 column)
   - ลบ Sheet อื่นที่ Google สร้างให้ default (เช่น "Sheet1")
4. เขียน .clasp.json สำหรับ link กับ project (rootDir: src)
5. เขียน .gitignore ให้ครอบคลุม .clasp.json (มี scriptId) และไฟล์ที่ไม่ควร commit

จบแล้ว commit และบอกขั้นตอนที่ต้องทำใน terminal:
- clasp create --title "App-Room" --type sheets
- วิธี copy scriptId ใส่ .clasp.json
- clasp push
- วิธีรัน setupSheets() ใน Apps Script Editor
```

---

## Session 2: DataService.gs + Code.gs

```
อ่าน CLAUDE.md และ design.md ก่อน

Session 1 เสร็จแล้ว: มี src/ พร้อม appsscript.json และ SheetSetup.gs
Sheets "ตั้งค่า" และ "บันทึก" ถูกสร้างแล้วโดย setupSheets()

งาน Session 2: เขียน backend functions

1. src/DataService.gs — functions ทั้งหมดที่ใช้อ่าน/เขียน Sheets:
   - getRoom(roomId) → {name, rent, furniture} หรือ null ถ้าไม่พบ
   - getRates(building) → {water, electricity} ราคาต่อหน่วยของตึง C หรือ R
   - getPrevMeter(roomId, monthYear) → {elecEnd, waterEnd} จาก row เดือนก่อน
   - getRecordThisMonth(roomId, monthYear) → row data หรือ null
   - saveRecord(data) → เขียน row ใหม่หรืออัปเดต row เดิม (ถ้าแก้ไขทับ)
     - เมื่อแก้ไขทับ: ห้ามแตะ column จ่ายจริง (col 20) และสถานะ (col 21)
     - ใส่ Sheets Formula ใน cell ค้างเดือนก่อน (col 13) ตาม design.md
   - updatePayment(roomId, monthYear, paidAmount) → อัปเดต จ่ายจริง และ สถานะ อัตโนมัติ
   - updateFine(roomId, monthYear, fineAmount) → อัปเดต ค่าปรับ
   - getDashboardData(monthYear) → summary + รายห้องทั้งหมด
   - getMissingRooms(monthYear) → รายชื่อห้องที่ยังไม่กรอกมิเตอร์เดือนนี้
   - updateRoomInfo(roomId, {name, rent, furniture}) → แก้ข้อมูลใน "ตั้งค่า"

2. src/Code.gs — doGet(e) routing:
   - ?page=admin → serve admin.html
   - default → serve staff.html
   - checkPassword(pw) → เปรียบเทียบกับ Script Properties ADMIN_PASSWORD
   - expose functions ที่ client จะเรียกผ่าน google.script.run

จบแล้ว commit
```

---

## Session 3: staff.html (หน้าพนักงาน)

```
อ่าน CLAUDE.md และ design.md ก่อน

Session 1-2 เสร็จแล้ว: มี SheetSetup.gs และ DataService.gs + Code.gs ครบ

งาน Session 3: เขียน src/staff.html — หน้าพนักงานจดมิเตอร์ (mobile-first)

Flow:
1. แสดง input กรอกเลขห้อง (เช่น C201, R15)
2. กด "ค้นหา" → เรียก google.script.run เพื่อเช็คห้อง:
   - ไม่พบ → แสดง error "ไม่พบห้องนี้ กรุณาติดต่อแอดมิน"
   - พบ + ยังไม่มีข้อมูลเดือนนี้ → แสดง form จดมิเตอร์ (ดึง "เริ่ม" จากเดือนก่อน lock ไม่ให้แก้)
   - พบ + มีข้อมูลแล้ว → แสดงปุ่ม [แก้ไขทับ] และ [ยกเลิก]
3. Form: มิเตอร์ไฟ "ถึง", มิเตอร์น้ำ "ถึง", รายการอื่นๆ 2 รายการ (ชื่อ+จำนวน)
4. กด "คำนวณ" → แสดงยอดรวม (ไม่รวมค่าปรับ)
5. กด "บันทึก" → saveRecord() → success message

Design: mobile-friendly, font ใหญ่, ปุ่มใหญ่, ไม่ต้อง login
แสดง: ชื่อผู้เช่า, ยอดค้างเดือนก่อน (ถ้ามี) เพื่อให้พนักงานทราบ

จบแล้ว commit
```

---

## Session 4: admin.html (หน้าแอดมิน)

```
อ่าน CLAUDE.md และ design.md ก่อน

Session 1-3 เสร็จแล้ว: backend ครบ, staff.html เสร็จแล้ว

งาน Session 4: เขียน src/admin.html — หน้าแอดมิน

ส่วนที่ 1: Login
- แสดง password form เมื่อโหลด
- checkPassword() ผ่าน google.script.run
- เก็บ session ใน sessionStorage ฝั่ง client

ส่วนที่ 2: Dashboard (แสดงเมื่อ login แล้ว)
- Summary เดือนปัจจุบัน: จำนวนห้องทั้งหมด / จ่ายแล้ว / ยังไม่จ่าย
  ยอดที่ควรเก็บ / เก็บได้จริง / ค้างรวม
- ตารางห้องที่ยังไม่จ่าย: เลขห้อง, ผู้เช่า, ยอดเดือนนี้, ยอดค้างสะสม, จำนวนเดือนที่ค้าง
- แจ้งเตือน: รายชื่อห้องที่ยังไม่กรอกมิเตอร์เดือนนี้

ส่วนที่ 3: จัดการบิล (ต่อห้อง)
- ตารางห้องทั้งหมดเดือนนี้ กรอก "จ่ายจริง" และ "ค่าปรับ" ได้
- บันทึก → อัปเดต Sheet, สถานะเปลี่ยน "จ่ายแล้ว" อัตโนมัติเมื่อ จ่ายจริง >= รวม

ส่วนที่ 4: บิล print-friendly
- กดดูบิลรายห้อง → popup/หน้าใหม่แสดงบิลครบ:
  ชื่อผู้เช่า, เลขห้อง, เดือน, ค่าเช่า, ค่าน้ำ (หน่วย+เงิน), ค่าไฟ (หน่วย+เงิน),
  ค่าเฟอร์นิเจอร์, รายการอื่นๆ, ค้างเดือนก่อน, ค่าปรับ, รวม, จ่ายจริง, สถานะ
- ปุ่ม "พิมพ์" (window.print())

ส่วนที่ 5: จัดการห้อง
- แก้ชื่อผู้เช่า, ค่าเช่า, ค่าเฟอร์นิเจอร์ รายห้อง → updateRoomInfo()

จบแล้ว commit
```

---

## Session 5: ทดสอบ + Deploy

```
อ่าน CLAUDE.md และ design.md ก่อน

Session 1-4 เสร็จแล้ว: โค้ดครบทุกไฟล์ใน src/

งาน Session 5: ทดสอบและ deploy

1. clasp push และเปิด Web App ทดสอบ:
   - ทดสอบ staff.html: กรอกห้องที่มี/ไม่มี, จดมิเตอร์, บันทึก, แก้ไขทับ
   - ทดสอบ admin.html: login, dashboard, กรอกจ่ายจริง, ดูบิล, พิมพ์
   - ทดสอบ formula ค้างเดือนก่อน: กรอกจ่ายจริงเดือนก่อน แล้วเช็คว่าค้างเดือนนี้อัปเดต

2. แก้บั๊กที่พบ

3. ตั้ง ADMIN_PASSWORD ใน Script Properties

4. Deploy as Web App:
   - Execute as: Me
   - Who has access: Anyone
   - บันทึก URL ทั้ง 2 ลิงก์ (?page=staff และ ?page=admin)

5. เตรียมส่งมอบ:
   - ลบข้อมูลทดสอบออกจาก Sheet "บันทึก" (เหลือแต่ header)
   - เขียนคู่มือส่งมอบสั้นๆ: วิธี Transfer Ownership, วิธี Deploy ใหม่หลังรับโอน

จบแล้ว commit
```
```
code edit
https://script.google.com/d/1uP1yiroqBv4hInGJ1jbQxRyznieX4QWczv4RhLok8qUFKkNZIQ0dHiro/edit

sheet
https://docs.google.com/spreadsheets/d/1AVl6OKR59dEVLtIZ7lC_zaIxtCcy2IR3cCB30pPEjLw/edit

```