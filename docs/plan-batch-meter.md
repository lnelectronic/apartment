# Plan: Batch Meter Entry + Role System

## Domain Vocabulary (ใช้ตลอดโปรเจกต์)

| คำ | หมายถึง | สิทธิ์ |
|----|---------|--------|
| **owner** | เจ้าของหอ | ทุกอย่าง + approve มิเตอร์ + แก้ค่าเช่า/เฟอร์นิเจอร์ |
| **staff** | พนักงานดูแลหอ | จดมิเตอร์ + รับเงิน + กรอกจ่ายจริง/ค่าปรับ + ส่งบิล |

---

## สรุป Design Decisions

### Batch Meter Entry
- Staff เลือก session จาก **4 ปุ่ม** (ตึง C ไฟ / ตึง C น้ำ / ตึง R ไฟ / ตึง R น้ำ) → เห็นเฉพาะห้องในตึงนั้น (~19 หรือ ~28 ห้อง)
- แต่ละห้องแสดง: เลขห้อง, ชื่อผู้เช่า, มิเตอร์เริ่ม (readonly), input ถึง
- ห้องที่จดไปแล้วเดือนนี้ → **prefill** ค่า "ถึง" ที่บันทึกไว้ (แก้ได้)
- กด submit → review screen (เริ่ม / ถึง / ใช้ไป / เป็นเงิน ต่อห้อง สำหรับ utility ที่จดมา)
- กด confirm → save เป็น draft ลง sheet "บันทึก"
- ต้องทำ **4 sessions ต่อเดือน** (2 ตึง × 2 ประเภทมิเตอร์) — ทำสลับลำดับได้ ไม่มี dependency

### Building Split (ข้อค้นพบจาก grilling 2026-06-29)
- **ตึง C และ ตึง R ห่างกัน 3 กม.** + staff คนละคนดูแลแต่ละตึง
- Staff login เดียวกัน password เดียวกัน (สลับกันช่วยได้) แต่ทำงาน batch ทีละตึง
- Owner approve **ทั้งเดือนรวดเดียว** (รอครบทั้งสองตึง) — `confirmMonth()` ไม่เปลี่ยน
- Warning บน approval screen จะครอบคลุมกรณีที่ตึงใดตึงหนึ่งยังไม่จดครบโดยอัตโนมัติ

### Draft & Approval Flow
- เพิ่ม column **สถานะมิเตอร์** (col 23) ใน sheet "บันทึก"
  - `draft-elec` — จดไฟแล้ว ยังไม่มีน้ำ
  - `draft-water` — จดน้ำแล้ว ยังไม่มีไฟ
  - `draft` — ครบทั้งไฟและน้ำ รอ owner approve
  - `confirmed` — owner approve แล้ว
- Owner approve **ทั้งเดือนรวดเดียว** ไม่ทีละห้อง
- ระบบ **warn แต่ไม่ block** ถ้ายังมีห้องที่ draft-elec หรือ draft-water ค้างอยู่

### ห้องว่าง (Empty Room Detection)
- ห้องว่าง = ชื่อผู้เช่าใน sheet "ตั้งค่า" ว่างเปล่า
- ยังต้องจดมิเตอร์ทุกเดือน (ตรวจการแอบใช้)
- **flag** ห้องว่างที่ใช้ไป > 0 หน่วย ทั้งไฟและน้ำ

### Staff Page Update
- `staff.html` เดิม: บังคับกรอกทั้งไฟและน้ำ → **แก้ให้กรอกแค่ประเภทเดียวได้**
- ถ้า staff จด batch ผิด แก้ได้ผ่าน staff.html ทีละห้อง (ไม่ต้อง re-submit 47 ห้อง)

### Authentication
- **2 passwords** เก็บใน Script Properties
  - `OWNER_PASSWORD` — full access
  - `STAFF_PASSWORD` — limited access
- Login หน้าเดียวกัน ระบบ detect role จาก password ที่กรอก

### URL Structure

| URL | ใครใช้ | หลัง login เห็น |
|-----|--------|----------------|
| `?page=staff` | staff | menu: จดมิเตอร์ทีละห้อง / จด batch |
| `?page=admin` | owner | dashboard เดิม + approval screen + แก้ค่าเช่าได้ |

### Permission Matrix

| Feature | staff | owner |
|---------|-------|-------|
| จดมิเตอร์ batch | ✅ | ✅ |
| จดมิเตอร์ทีละห้อง | ✅ | ✅ |
| กรอกจ่ายจริง / ค่าปรับ | ✅ | ✅ |
| ส่งบิล LINE | ✅ | ✅ |
| approve มิเตอร์ทั้งเดือน | ❌ | ✅ |
| แก้ค่าเช่า / ค่าเฟอร์นิเจอร์ | ❌ | ✅ |
| ดู dashboard ทั้งหมด | ❌ | ✅ |

---

## Implementation Sessions

---

### Session 1 — Role & Auth

**เป้าหมาย**: เพิ่ม staff login ใน `?page=staff` และแยก 2 password

**ไฟล์ที่แก้**:
- `src/DataService.gs` — เพิ่ม `checkStaffPassword()` และ `checkOwnerPassword()`
- `src/staff.html` — เพิ่ม login screen ก่อนเห็นหน้าหลัก, หลัง login แสดง menu 2 ตัวเลือก: "จดมิเตอร์ทีละห้อง" / "จด batch ทุกห้อง"
- `src/admin.html` — เปลี่ยน property key จาก `ADMIN_PASSWORD` → `OWNER_PASSWORD`
- `src/SheetSetup.gs` — เปลี่ยน default Script Property key

**Script Properties ที่ต้องตั้ง**:
- `OWNER_PASSWORD` (เดิมคือ `ADMIN_PASSWORD`)
- `STAFF_PASSWORD` (ใหม่)

**ทดสอบ**:
- กรอก STAFF_PASSWORD → เห็น menu ใน staff.html
- กรอก OWNER_PASSWORD → เข้า admin.html ได้
- กรอก password ผิด → error

---

**Prompt สั่งงาน Session 1:**

```
อ่าน docs/plan-batch-meter.md ก่อน แล้วทำ Session 1: Role & Auth

งาน:
1. เพิ่ม checkStaffPassword() และ checkOwnerPassword() ใน DataService.gs (เหมือน checkPassword() เดิม แต่ใช้ key STAFF_PASSWORD และ OWNER_PASSWORD)
2. admin.html: เปลี่ยน ADMIN_PASSWORD → OWNER_PASSWORD ทุกที่
3. staff.html: เพิ่ม login screen (ก่อน section จดมิเตอร์) ใช้ checkStaffPassword() — ถ้าผ่านแล้วแสดง menu 2 ปุ่ม: "จดมิเตอร์ทีละห้อง" (flow เดิม) / "จด batch ทุกห้อง" (placeholder ไว้ก่อน)
4. SheetSetup.gs: เปลี่ยน ADMIN_PASSWORD → OWNER_PASSWORD

อย่าแก้ logic จดมิเตอร์ใด ๆ ใน session นี้ แค่ auth และ menu เท่านั้น
```

---

### Session 2 — Data Model: Draft Status

**เป้าหมาย**: เพิ่ม column สถานะมิเตอร์ และ update DataService.gs ให้ save draft

**ไฟล์ที่แก้**:
- `design.md` — เพิ่ม column 23 `สถานะมิเตอร์`
- `src/SheetSetup.gs` — เพิ่ม header column 23
- `src/DataService.gs`
  - `saveRecord()`: รับ param `meterType` (`'elec'|'water'|'both'`) และ save status ตามนั้น
  - ถ้า row มีอยู่แล้ว: merge ข้อมูล (เช่น draft-elec + water data → draft)
  - เพิ่ม `confirmMonth(monthStr)` — เปลี่ยน status ทุก row ของเดือนนั้นจาก draft → confirmed

**Logic สถานะ**:
```
save elec เท่านั้น:
  - ถ้า row ยังไม่มี → สร้างใหม่ status = "draft-elec"
  - ถ้า row มี draft-water อยู่แล้ว → update elec columns + status = "draft"

save water เท่านั้น:
  - ถ้า row ยังไม่มี → สร้างใหม่ status = "draft-water"
  - ถ้า row มี draft-elec อยู่แล้ว → update water columns + status = "draft"
```

**ทดสอบ**:
- save elec → col 23 = "draft-elec"
- save water ห้องเดิม → col 23 = "draft"
- confirmMonth("6/2026") → col 23 = "confirmed"

---

**Prompt สั่งงาน Session 2:**

```
อ่าน docs/plan-batch-meter.md และ design.md ก่อน แล้วทำ Session 2: Data Model Draft Status

งาน:
1. design.md: เพิ่ม column 23 ชื่อ "สถานะมิเตอร์" ในตาราง Column Index
2. SheetSetup.gs: เพิ่ม header "สถานะมิเตอร์" ใน column 23 ตอน setup sheet
3. DataService.gs — แก้ saveRecord():
   - เพิ่ม param meterType: 'elec' | 'water' | 'both'
   - ถ้า row ยังไม่มี → สร้างใหม่ บันทึก status ตาม meterType (draft-elec / draft-water / draft)
   - ถ้า row มีอยู่แล้ว → merge: draft-elec + water data = draft, draft-water + elec data = draft
   - อย่าแตะ status ของ row ที่เป็น "confirmed" แล้ว (return error แทน)
4. DataService.gs — เพิ่ม confirmMonth(monthStr): loop ทุก row ของเดือนนั้น เปลี่ยน status draft/draft-elec/draft-water → "confirmed"

อย่าแก้ UI ใด ๆ ใน session นี้
```

---

### Session 3 — Update staff.html: Partial Meter Entry

**เป้าหมาย**: แก้ flow ทีละห้องใน staff.html ให้รับแค่ ไฟ หรือ น้ำ อย่างใดอย่างหนึ่งได้

**ไฟล์ที่แก้**:
- `src/staff.html`

**สิ่งที่ต้องแก้**:
- เพิ่ม toggle/radio เลือก mode: "ไฟ" / "น้ำ" / "ทั้งคู่"
- validation: ถ้า mode=elec ไม่ validate water fields (และซ่อน water section)
- ถ้า mode=water ไม่ validate elec fields (และซ่อน elec section)
- ส่ง meterType ไปให้ saveRecord() ตาม mode ที่เลือก

**ทดสอบ**:
- เลือก mode=elec → กรอกแค่ไฟ → save ได้ → sheet col 23 = "draft-elec"
- เลือก mode=water → กรอกแค่น้ำ → save ได้ → sheet col 23 = "draft-water"
- เลือก mode=both → ต้องกรอกทั้งคู่เหมือนเดิม

---

**Prompt สั่งงาน Session 3:**

```
อ่าน docs/plan-batch-meter.md และ design.md ก่อน แล้วทำ Session 3: Partial Meter Entry ใน staff.html

งาน:
1. เพิ่ม toggle เลือก mode: "ไฟ" / "น้ำ" / "ทั้งคู่" ใต้ช่องกรอกเลขห้อง (ก่อน section มิเตอร์)
2. เมื่อเลือก mode → ซ่อน/แสดง section ไฟ และ น้ำ ตาม mode
3. แก้ validation: validate เฉพาะ field ของ mode ที่เลือก
4. ส่ง meterType ('elec'|'water'|'both') ไปให้ saveRecord() (เพิ่งสร้างใน Session 2)
5. แก้ review screen (ตอนแสดงยอดก่อนบันทึก) ให้แสดงเฉพาะ section ที่กรอกมา

Session 2 ต้อง deploy ก่อน session นี้
```

---

### Session 4 — Batch Meter Entry UI

**เป้าหมาย**: สร้างหน้า batch entry ใน staff.html (เลือกจาก menu)

**ไฟล์ที่แก้**:
- `src/staff.html` — เพิ่ม batch section
- `src/DataService.gs` — เพิ่ม `getAllRoomsWithPrevMeter(monthStr, meterType, building)` คืน array ของห้องในตึงนั้นพร้อม prev meter และข้อมูลเดือนนี้ (ถ้ามี)

**Flow**:
1. Staff กด "จด batch ทุกห้อง" → เห็น **4 ปุ่ม**: ตึง C — ไฟ / ตึง C — น้ำ / ตึง R — ไฟ / ตึง R — น้ำ
2. เลือก 1 ปุ่ม → โหลด list ห้องในตึงนั้น (~19 หรือ ~28 ห้อง) พร้อมค่า เริ่ม จาก server
3. แสดงตาราง scroll: เลขห้อง | ชื่อผู้เช่า | เริ่ม | input ถึง — ห้องที่จดไปแล้วเดือนนี้ **prefill** ค่า "ถึง" เดิม
4. กด submit → **review screen**: แสดงทุกห้องที่กรอก (ข้ามห้องที่ไม่ได้กรอก) พร้อม เริ่ม / ถึง / ใช้ไป / เป็นเงิน
5. ห้องว่าง (ชื่อผู้เช่าว่าง) ที่ใช้ไป > 0 → **flag สีแดง** ใน review screen
6. กด confirm → save ทุกห้องเป็น batch (meterType=elec หรือ water)

**`getAllRoomsWithPrevMeter(monthStr, meterType, building)`**:
- `building`: `'C'` หรือ `'R'` — filter ด้วย `room[0] === building`
- ดึงรายชื่อห้องในตึงนั้นจาก "ตั้งค่า" (A6:F51)
- สำหรับแต่ละห้อง ดึง prevMeter (elec หรือ water) จาก "บันทึก" เดือนก่อน
- ดึง existingEnd จาก "บันทึก" เดือนนี้ (ถ้ามี) — สำหรับ prefill
- คืน array: `[{room, tenantName, prevMeter, existingEnd, isEmpty}]`
  - `prevMeter`: ค่า "ถึง" เดือนก่อน (ใช้เป็นค่า "เริ่ม")
  - `existingEnd`: ค่า "ถึง" เดือนนี้ถ้ามีอยู่แล้ว, `null` ถ้ายังไม่ได้จด

**ทดสอบ**:
- เลือก "ตึง C — ไฟ" → เห็นเฉพาะ 19 ห้องตึง C (ไม่มีตึง R)
- เลือก "ตึง R — น้ำ" → เห็นเฉพาะ ~28 ห้องตึง R
- ห้องที่จดไฟไปแล้ว เปิด batch ซ้ำ → prefill ค่าเดิม
- กรอกบางห้อง submit → review เห็นเฉพาะห้องที่กรอก
- ห้องว่างที่ใช้ > 0 → มี flag
- confirm → sheet ได้รับข้อมูลครบ status = draft-elec หรือ draft-water

---

**Prompt สั่งงาน Session 4:**

```
อ่าน docs/plan-batch-meter.md และ design.md ก่อน แล้วทำ Session 4: Batch Meter Entry UI

งาน:
1. DataService.gs: เพิ่ม getAllRoomsWithPrevMeter(monthStr, meterType, building)
   - building: 'C' หรือ 'R' — filter ด้วย room[0] === building
   - ดึงรายชื่อห้องในตึงนั้นจาก "ตั้งค่า" (A6:F51)
   - สำหรับแต่ละห้อง ดึง prevMeter (ค่า "ถึง" ของ elec หรือ water จากเดือนก่อน)
   - ดึง existingEnd จากเดือนนี้ (ถ้ามี) เพื่อ prefill
   - คืน array: [{room, tenantName, prevMeter, existingEnd, isEmpty}]

2. staff.html: แทนที่ sect-batch placeholder ด้วย batch flow จริง
   - step 1 (เลือก session): 4 ปุ่ม — "ตึง C ⚡ ไฟ" / "ตึง C 💧 น้ำ" / "ตึง R ⚡ ไฟ" / "ตึง R 💧 น้ำ"
   - step 2 (ตาราง): โหลดห้องในตึงนั้น แสดง scroll table (เลขห้อง | ชื่อผู้เช่า | เริ่ม | input ถึง)
     ห้องที่มี existingEnd → prefill input "ถึง" ด้วยค่านั้น, ห้องว่าง label ว่า "(ว่าง)"
   - step 3 (review): แสดงเฉพาะห้องที่กรอก พร้อม เริ่ม/ถึง/ใช้ไป/เป็นเงิน
     ห้องว่างที่ใช้ > 0 แสดง badge "⚠ ห้องว่าง"
   - step 4 (confirm): เรียก saveRecord() แบบ batch สำหรับทุกห้องที่กรอก

Session 1, 2, 3 ต้อง deploy ก่อน session นี้
```

---

### Session 5 — Owner Approval Screen

**เป้าหมาย**: เพิ่มหน้า approve มิเตอร์ทั้งเดือนใน admin.html

**ไฟล์ที่แก้**:
- `src/admin.html` — เพิ่ม tab/section "ตรวจมิเตอร์"
- `src/DataService.gs` — เพิ่ม `getMonthMeterSummary(monthStr)`

**Flow**:
1. Owner เลือก section "ตรวจมิเตอร์" (หรือ tab ใหม่)
2. เลือกเดือน/ปีที่ต้องการ approve
3. ระบบโหลดทุกห้องพร้อม: ไฟ (เริ่ม/ถึง/ใช้ไป) + น้ำ (เริ่ม/ถึง/ใช้ไป) + สถานะมิเตอร์
4. Warning banner ถ้ามีห้องที่ status ยังเป็น draft-elec หรือ draft-water (ไม่ครบทั้งคู่)
5. Flag ห้องว่างที่มีการใช้งาน
6. แก้ไขทีละห้อง → เปิด modal หรือ redirect ไป staff.html single room
7. ปุ่ม "Approve ทั้งเดือน" → เรียก confirmMonth() → status ทุก row = confirmed

**ทดสอบ**:
- เห็นทุกห้องพร้อม status
- warning ถ้ามี draft-elec/draft-water ค้าง
- flag ห้องว่างที่มีการใช้
- approve → status เปลี่ยนเป็น confirmed ทุกห้อง

---

**Prompt สั่งงาน Session 5:**

```
อ่าน docs/plan-batch-meter.md และ design.md ก่อน แล้วทำ Session 5: Owner Approval Screen

งาน:
1. DataService.gs: เพิ่ม getMonthMeterSummary(monthStr)
   - ดึงทุก row ของเดือนนั้นจาก "บันทึก"
   - คืน array: [{room, tenantName, isEmpty, elecStart, elecEnd, elecUsed, waterStart, waterEnd, waterUsed, meterStatus}]
   - รวม warning list: ห้องที่ status = draft-elec หรือ draft-water
   - รวม flag list: ห้องว่างที่ elecUsed > 0 หรือ waterUsed > 0

2. admin.html: เพิ่ม section "ตรวจมิเตอร์" (เพิ่มใน bottom nav หรือ tab)
   - เลือกเดือน/ปี
   - แสดง warning banner ถ้ามีห้องที่ข้อมูลไม่ครบ
   - ตาราง: เลขห้อง | ชื่อผู้เช่า | ไฟ (เริ่ม/ถึง/ใช้ไป) | น้ำ (เริ่ม/ถึง/ใช้ไป) | สถานะ
   - ห้องว่างที่มีการใช้ → highlight แดง
   - ปุ่มแก้ไขรายห้อง (เปิด modal หรือ redirect)
   - ปุ่ม "Approve ทั้งเดือน" → เรียก confirmMonth()

Session 1–4 ต้อง deploy ก่อน session นี้
```

---

### Session 6 — Lock ค่าเช่า/ค่าเฟอร์นิเจอร์ (Owner Only)

**เป้าหมาย**: ซ่อน/ล็อคการแก้ค่าเช่าและค่าเฟอร์นิเจอร์ใน staff page

**ไฟล์ที่แก้**:
- `src/admin.html` — ตรวจสอบ session role ก่อนแสดง edit fields
- `src/DataService.gs` — `updateRoomSettings()` ตรวจว่าเป็น owner เท่านั้น

**ทดสอบ**:
- login เป็น staff → ไม่เห็นปุ่มแก้ค่าเช่า
- login เป็น owner → เห็นและแก้ได้

---

**Prompt สั่งงาน Session 6:**

```
อ่าน docs/plan-batch-meter.md ก่อน แล้วทำ Session 6: Lock ค่าเช่า/ค่าเฟอร์นิเจอร์

งาน:
1. admin.html: section จัดการห้อง (แก้ชื่อผู้เช่า, ค่าเช่า, ค่าเฟอร์นิเจอร์)
   - ช่อง "ค่าเช่า" และ "ค่าเฟอร์นิเจอร์" → แสดงเฉพาะเมื่อ session role = owner
   - staff เห็นแค่ชื่อผู้เช่า (แก้ได้) แต่ค่าเช่า/เฟอร์นิเจอร์เป็น readonly
2. DataService.gs: updateRoomSettings() ตรวจ caller role — ถ้าพยายามแก้ค่าเช่า/เฟอร์นิเจอร์โดยไม่ใช่ owner → return error

หมายเหตุ: session นี้ทำได้พร้อมกับ Session 5 หรือหลังก็ได้ ไม่มี dependency กัน
```

---

## Dependencies ระหว่าง Sessions

```
Session 1 (Auth)
    └── Session 2 (Data Model)
            └── Session 3 (Partial Entry)
                    └── Session 4 (Batch UI)
                            └── Session 5 (Approval)

Session 6 (Lock) — ทำได้ตั้งแต่หลัง Session 1
```
