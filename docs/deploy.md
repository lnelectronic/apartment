# คู่มือ Deploy — App-Room

## ขั้นตอนที่ 1 — เปิด Script Editor

เปิด browser ไปที่:
```
https://script.google.com/d/1uP1yiroqBv4hInGJ1jbQxRyznieX4QWczv4RhLok8qUFKkNZIQ0dHiro/edit
```

---

## ขั้นตอนที่ 2 — ตั้ง Admin Password

1. ใน Script Editor → เมนู **Project Settings** (รูปเฟือง ⚙️)
2. เลื่อนลงหา **Script Properties**
3. กด **Add script property**
   - Property: `ADMIN_PASSWORD`
   - Value: `<รหัสผ่านที่ต้องการ>`
4. กด **Save script properties**

---

## ขั้นตอนที่ 3 — Run setupSheets() ครั้งเดียว

1. Script Editor → เลือก function `setupSheets` จาก dropdown (ด้านบนใกล้ปุ่ม ▶)
2. กด ▶ **Run**
3. ครั้งแรกจะขอ permission → กด **Review permissions** → **Allow**
4. รอจนเห็น Execution log ว่า: `Setup สำเร็จ! ห้องทั้งหมด 46 ห้อง พร้อมใช้งาน`

ตรวจสอบที่ Spreadsheet:
```
https://docs.google.com/spreadsheets/d/1AVl6OKR59dEVLtIZ7lC_zaIxtCcy2IR3cCB30pPEjLw/edit
```
ต้องเห็น Sheet "ตั้งค่า" และ "บันทึก" พร้อม header ครบ

---

## ขั้นตอนที่ 4 — กรอกข้อมูลห้องใน Sheet "ตั้งค่า"

| ตำแหน่ง | ข้อมูลที่ต้องกรอก |
|---------|-----------------|
| row 2 col B | ราคาน้ำต่อหน่วย ตึก C (บาท) |
| row 2 col C | ราคาไฟต่อหน่วย ตึก C (บาท) |
| row 3 col B | ราคาน้ำต่อหน่วย ตึก R (บาท) |
| row 3 col C | ราคาไฟต่อหน่วย ตึก R (บาท) |
| col B (แต่ละห้อง) | ชื่อผู้เช่า |
| col C (แต่ละห้อง) | ค่าเช่า (บาท) |
| col D (แต่ละห้อง) | ค่าเฟอร์นิเจอร์ (บาท) |
| col E (แต่ละห้อง) | เลขมิเตอร์ไฟเริ่มต้น (หน่วย) — สำหรับเดือนแรก |
| col F (แต่ละห้อง) | เลขมิเตอร์น้ำเริ่มต้น (หน่วย) — สำหรับเดือนแรก |

---

## ขั้นตอนที่ 5 — Deploy Web App

1. Script Editor → เมนู **Deploy** → **New deployment**
2. กด ⚙️ ที่ **Select type** → เลือก **Web app**
3. ตั้งค่า:
   - **Description**: `v1`
   - **Execute as**: `Me` (ชื่อ account ของตัวเอง)
   - **Who has access**: `Anyone`
4. กด **Deploy**
5. Copy URL ที่ได้ (รูปแบบ `https://script.google.com/macros/s/.../exec`)

URL ทั้ง 3 หน้า:

| หน้า | URL |
|------|-----|
| พนักงานเต็มรูปแบบ (จดมิเตอร์ + เห็นยอด) | `...exec?page=staff` |
| พนักงานจดมิเตอร์อย่างเดียว (ไม่เห็นยอดเงิน) | `...exec?page=meter` |
| Admin (Dashboard + บิล + จัดการห้อง) | `...exec?page=admin` |

---

## ขั้นตอนที่ 6 — ทดสอบก่อนใช้งานจริง

1. **meter.html** (`?page=meter`)
   - กรอกเลขห้องที่มีในระบบ → ระบุมิเตอร์ → กด บันทึก
   - ตรวจ Sheet "บันทึก" ต้องมี row ใหม่ปรากฏ

2. **staff.html** (`?page=staff`)
   - ค้นหาห้องที่จดไปแล้ว → ระบบถามแก้ไขทับ/ยกเลิก
   - ค้นหาห้องใหม่ → กรอกมิเตอร์ → คำนวณ → ตรวจยอด → บันทึก

3. **admin.html** (`?page=admin`)
   - Login ด้วย ADMIN_PASSWORD ที่ตั้งไว้
   - Dashboard → ดูสถิติ + ตารางค้างจ่าย
   - Billing tab → กรอกจ่ายจริง → บันทึก → สถานะเปลี่ยนเป็น "จ่ายแล้ว"
   - ดูบิล → พิมพ์

4. **ทดสอบ formula ค้างเดือนก่อน**
   - บันทึกห้องเดือนนี้ โดยยังไม่กรอกจ่ายจริง (จ่ายจริง = 0)
   - เดือนถัดไป บันทึกห้องเดิม → ค้างเดือนก่อนใน Sheet ต้องแสดงยอดที่ค้าง

---

## ขั้นตอนที่ 7 — อัปเดตโค้ดหลัง clasp push (ครั้งต่อไป)

```bash
clasp push
```

จากนั้นใน Script Editor → **Deploy** → **Manage deployments** → เลือก deployment เดิม → **Edit (✏️)** → เปลี่ยน Version เป็น **New version** → **Deploy**

> URL ไม่เปลี่ยน เพราะใช้ deployment เดิม

---

## Transfer Ownership (เมื่อส่งมอบ)

1. เปิด Spreadsheet → **Share** → เพิ่ม email ผู้รับเป็น **Editor** แล้วโอนเป็น **Owner**
2. เปิด Script Editor → **Share** → เพิ่ม email ผู้รับเป็น **Owner** เช่นกัน
3. ผู้รับต้อง **Deploy ใหม่** (New deployment) เพื่อให้ "Execute as: Me" เป็น account ของผู้รับ
   - URL จะเปลี่ยน → ต้องแจ้ง URL ใหม่ให้พนักงานและผู้เช่า
