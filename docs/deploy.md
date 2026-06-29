# คู่มือ Deploy — App-Room

## ขั้นตอนที่ 1 — เปิด Script Editor

```
https://script.google.com/d/1uP1yiroqBv4hInGJ1jbQxRyznieX4QWczv4RhLok8qUFKkNZIQ0dHiro/edit
```

---

## ขั้นตอนที่ 2 — ตั้ง Password (2 role)

Script Editor → **Project Settings** (ไอคอน ⚙️) → **Script Properties** → Add property

### Owner (เจ้าของหอ) — เข้าหน้า `?page=admin`
| Property | Value | หมายเหตุ |
|----------|-------|---------|
| `OWNER_PASSWORD` | `รหัสเจ้าของ` | สิทธิ์เต็ม: approve มิเตอร์, แก้ค่าเช่า |

### Staff (พนักงานดูแล) — เข้าหน้า `?page=staff`

**พนักงานคนเดียว:**
| Property | Value |
|----------|-------|
| `STAFF_PASSWORD` | `รหัสพนักงาน` |

**พนักงานหลายคน (แนะนำ):**
| Property | Value |
|----------|-------|
| `STAFF_PASSWORDS` | `["รหัสคน1","รหัสคน2"]` |

> ถ้ามีทั้ง `STAFF_PASSWORDS` และ `STAFF_PASSWORD` → `STAFF_PASSWORDS` ถูกใช้ก่อนเสมอ
> ต้องเป็น JSON array จริงๆ รวมถึง `[`, `"`, `]` — ถ้า format ผิดระบบจะแสดง error บอก

> **หมายเหตุ**: ถ้า migrate จากระบบเดิมที่ใช้ `ADMIN_PASSWORD` อยู่แล้ว ไม่ต้องลบ — ระบบ fallback ให้อัตโนมัติจนกว่าจะตั้ง `OWNER_PASSWORD` ใหม่

---

## ขั้นตอนที่ 3 — Run setupSheets() ครั้งเดียว

1. Script Editor → เลือก function `setupSheets` จาก dropdown → กด ▶ **Run**
2. ครั้งแรกจะขอ permission → **Review permissions** → **Allow**
3. รอจนเห็น Execution log: `Setup สำเร็จ! ห้องทั้งหมด 46 ห้อง พร้อมใช้งาน`

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
| col B (แต่ละห้อง) | ชื่อผู้เช่า (ว่าง = ห้องว่าง) |
| col C (แต่ละห้อง) | ค่าเช่า (บาท) |
| col D (แต่ละห้อง) | ค่าเฟอร์นิเจอร์ (บาท) |
| col E (แต่ละห้อง) | เลขมิเตอร์ไฟเริ่มต้น (หน่วย) — fallback เดือนแรก |
| col F (แต่ละห้อง) | เลขมิเตอร์น้ำเริ่มต้น (หน่วย) — fallback เดือนแรก |

---

## ขั้นตอนที่ 5 — Deploy Web App

1. Script Editor → **Deploy** → **New deployment**
2. กด ⚙️ ที่ **Select type** → เลือก **Web app**
3. ตั้งค่า:
   - **Execute as**: `Me`
   - **Who has access**: `Anyone`
4. กด **Deploy** → Copy URL ที่ได้

URL ทั้ง 3 หน้า:

| หน้า | URL | Login |
|------|-----|-------|
| Staff (จดมิเตอร์ทีละห้อง / batch + จัดการบิล) | `...exec?page=staff` | STAFF_PASSWORD |
| Owner (Dashboard + approve มิเตอร์ + จัดการห้อง) | `...exec?page=admin` | OWNER_PASSWORD |
| พนักงานจดมิเตอร์อย่างเดียว (legacy) | `...exec?page=meter` | ไม่มี login |

### `/exec` vs `/dev`

| URL | รัน | เหมาะกับ |
|-----|-----|---------|
| `.../exec` | โค้ด version ที่ deploy ไว้ | ผู้ใช้จริง — stable |
| `.../dev` | โค้ดล่าสุด (ทันทีหลัง clasp push) | developer ทดสอบ |

> `/dev` รันได้เฉพาะ account เจ้าของ script เท่านั้น

---

## ขั้นตอนที่ 6 — ทดสอบก่อนใช้งานจริง

ดูรายละเอียด checklist ทดสอบได้ที่ [docs/test-guide.md](test-guide.md)

สรุปย่อ:
1. รัน `seedTestData()` ใน Script Editor — ใส่ข้อมูลจำลอง 6 เดือน (1–6/2026)
2. ทดสอบ `?page=meter`, `?page=staff`, `?page=admin` ตาม checklist
3. รัน `clearTestData()` เมื่อทดสอบเสร็จ ก่อนส่งมอบงานจริง

---

## ขั้นตอนที่ 7 — อัปเดตโค้ด (ครั้งต่อไป)

```bash
clasp push
```

จากนั้นต้อง **deploy ใหม่** เพื่อให้ `/exec` URL รับโค้ดใหม่:

Script Editor → **Deploy** → **Manage deployments** → เลือก deployment เดิม → ✏️ **Edit** → Version: **New version** → **Deploy**

> URL ไม่เปลี่ยน เพราะใช้ deployment เดิม
> ถ้าไม่ redeploy — `/exec` ยังรันโค้ดเก่า, `/dev` รันโค้ดใหม่แล้ว

---

## Transfer Ownership (เมื่อส่งมอบ)

1. Spreadsheet → **Share** → โอน Ownership ให้เจ้าของจริง
2. Script Editor → **Share** → โอน Ownership เช่นกัน
3. เจ้าของต้อง **Deploy ใหม่** (New deployment) เพื่อให้ "Execute as: Me" เป็น account ของเจ้าของ
   - URL จะเปลี่ยน → แจ้ง URL ใหม่ให้พนักงาน
4. ตั้ง Script Properties ใหม่ใน account ของเจ้าของ: `OWNER_PASSWORD` และ `STAFF_PASSWORDS`
