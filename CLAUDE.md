# App-Room: ระบบคำนวณค่าเช่าห้องพัก

## Tech Stack
- **Google Apps Script** (container-bound กับ Google Spreadsheet)
- **Google Sheets** เป็น database (2 sheets: "ตั้งค่า", "บันทึก")
- **clasp** สำหรับ push/deploy จาก local
- **HTML Service** สำหรับ Web App UI

## Project Structure (เป้าหมาย)
```
App-Room/
├── src/
│   ├── appsscript.json       # Apps Script manifest
│   ├── Code.gs               # Main: doGet(), routing
│   ├── SheetSetup.gs         # สร้าง/ตั้งค่า Sheets ครั้งแรก
│   ├── DataService.gs        # อ่าน/เขียนข้อมูล Sheets
│   ├── staff.html            # หน้าพนักงานจดมิเตอร์
│   └── admin.html            # หน้าแอดมิน (Dashboard + จัดการบิล)
├── CLAUDE.md
├── design.md                 # Architecture decisions + column index + formula spec
└── requirement.md
```

## Key Decisions (อย่าเปลี่ยนโดยไม่ปรึกษา)

### Sheet Structure
- **Sheet 1: "ตั้งค่า"** — ราคาน้ำ/ไฟแยกตึก + รายชื่อห้องทั้งหมด
- **Sheet 2: "บันทึก"** — ข้อมูลทุกห้องทุกเดือน
- ไม่มี Sheet 3 Dashboard (แสดงใน Admin Web App แทน)

### Room Naming
- **ตึกชยางกูร** → prefix `C` → `C101`, `C201`..`C209`, `C301`..`C309`
- **ตึก Runway** → prefix `R` → `R15`..`R39`, `RC1`..`RC4`
- Parse ตึกด้วย `room[0]` (`C` หรือ `R`)
- รวม 46 ห้อง (C: 19, R: 27)

### Web App
- **1 deployment**, แยกหน้าด้วย URL parameter: `?page=staff` และ `?page=admin`
- **Execute as: Me** (เจ้าของ Sheet)
- **Admin auth**: Password เก็บใน Script Properties key `ADMIN_PASSWORD`

### ค้างเดือนก่อน
- เก็บเป็น **Sheets Formula** ใน cell (ไม่ lock ค่า, dynamic)
- Formula: `=IFERROR(รวมเดือนก่อน - จ่ายจริงเดือนก่อน, 0)`

### รายการอื่นๆ
- 2 รายการต่อห้องต่อเดือน → 4 column (`รายการ1`, `จำนวน1`, `รายการ2`, `จำนวน2`)

### บิล (print/share LINE)
- แสดงครบ: ชื่อผู้เช่า, ค่าเช่า, ค่าน้ำ, ค่าไฟ, เฟอร์นิเจอร์, รายการอื่นๆ, ค้างเดือนก่อน, ค่าปรับ, รวม, จ่ายจริง, สถานะ

## Workflow ทุก Session

1. อ่าน `design.md` ก่อนเสมอ — มี column index และ formula spec ครบ
2. ทดสอบด้วยข้อมูลปลอม (ห้องสมมติ) ก่อน deploy จริง
3. ก่อนส่งมอบ: ลบข้อมูลทดสอบออกจาก Sheet "บันทึก" ให้เหลือแค่โครงสร้าง

## Git Commits
- ห้ามใส่ชื่อ Claude ใน commit message ทุกรูปแบบ (ไม่มี Co-Authored-By)
- ใช้ `git commit -m "message"` ธรรมดา

## clasp Commands
```bash
# รันจาก root เสมอ (ที่อยู่ของ .clasp.json)
clasp push          # push โค้ดขึ้น Apps Script
clasp deploy        # สร้าง deployment ใหม่
# clasp open ใช้ไม่ได้บน WSL — เปิด browser เองที่ https://script.google.com/d/1uP1yiroqBv4hInGJ1jbQxRyznieX4QWczv4RhLok8qUFKkNZIQ0dHiro/edit
```

## ข้อมูลทดสอบ (เปลี่ยนก่อนส่งมอบ)
- ค่าน้ำ: 10 บาท/หน่วย (ทั้งสองตึก)
- ค่าไฟ: 5 บาท/หน่วย (ทั้งสองตึก)
- ค่าเช่าทดสอบ: 2,000 / 5,000 บาท
