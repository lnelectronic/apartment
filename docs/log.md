# Changelog — App-Room

บันทึกการแก้บักและเพิ่มฟีเจอร์ใหม่ทุกครั้ง

---

## 2026-06-29 (8)

### feat: Data Model — Draft Meter Status, col 23 สถานะมิเตอร์ (Session 2 — plan-batch-meter)

**การเปลี่ยนแปลง**:
- `design.md`: เพิ่ม col 23 `สถานะมิเตอร์` ใน Column Index ("draft-elec" / "draft-water" / "draft" / "confirmed")
- `SheetSetup.gs`:
  - `_setupRecordSheet()`: เพิ่ม header col 23 + `setColumnWidth(23, 120)`
  - `migrateAddMeterStatus()` (ใหม่): migration สำหรับ Sheet ที่มีข้อมูลอยู่แล้ว — เพิ่ม header + style col 23
- `DataService.gs`:
  - `saveRecord(data, meterType)`: รับ `meterType` ('elec'|'water'|'both', default 'both')
    - คำนวณ elec/water cost เฉพาะ type ที่ส่งมา (ป้องกัน waterMin ผิดเมื่อ elec-only)
    - update existing row แบบ partial — เขียนเฉพาะ cols ที่เกี่ยวกับ type นั้น
    - block แก้ไข row ที่ `meterStatus = 'confirmed'` → throw error
    - เขียน col 23 สถานะมิเตอร์ ทั้ง new row และ update
  - `_meterStatusForNew(meterType)` (ใหม่): คืน draft-elec / draft-water / draft
  - `_mergeMeterStatus(currentStatus, meterType)` (ใหม่): merge logic เช่น draft-elec + water → draft
  - `confirmMonth(monthStr)` (ใหม่): เปลี่ยน status draft* → confirmed ทุกห้องของเดือนนั้น; คืน `{ confirmed }`
  - `getRecordThisMonth()`: เพิ่ม field `meterStatus` (d[22]) ใน return object

---

## 2026-06-29 (7)

### feat: admin — bottom nav + rooms table + settings modal (Session 5)

**การเปลี่ยนแปลง**:
- **Bottom nav**: แทน `.tabs` top strip ด้วย fixed bottom nav bar (🏠 Dashboard · 📋 บิล · 🏘 ห้อง · 📊 มิเตอร์) — mobile-first
- **Top bar**: เพิ่มปุ่ม "จดมิเตอร์ ↗" ใน topbar แทนที่ tab ลิงก์เดิม
- **จัดการห้อง table**: เปลี่ยนจาก CSS grid 11 col → `<table>` ใน `.table-wrap { overflow-x: auto }` เหมือนหน้าจัดการบิล; เหลือ 8 col (ห้อง ชื่อ เบอร์ เช่า เฟอร์ มัดจำ วันย้ายเข้า [ปุ่ม])
- **⚙ Settings modal**: ปุ่ม icon gear ใน row เปิด modal `#modal-settings` สำหรับ Note (textarea) + ไฟ/น้ำเริ่มต้น — field เหล่านี้ถูกนำออกจาก main row
- **`saveRoomRow()`**: อ่าน note/elecInit/waterInit จาก `S.allRooms` cache แทน row inputs
- **`openStaffPage()` bug fix**: เรียก `google.script.url.getLocation` ตอนกดปุ่มทุกครั้ง แทนที่จะเก็บ URL ไว้ใน `_staffUrl` ที่อาจยัง empty ตอน click
- **CLAUDE.md**: บันทึก UI/UX decisions: mobile-first, horizontal scroll table, Note modal

---

## 2026-06-29 (6)

### feat: admin — check-in modal ย้ายเข้า (Session 4)

**การเปลี่ยนแปลง**:
- `renderRoomRows()`: เพิ่มปุ่ม "ย้ายเข้า" (btn-primary) สำหรับ `isVacant === true` (ก่อนหน้านี้ห้องว่างไม่มีปุ่มเลย)
- HTML `#modal-checkin`: fields ชื่อผู้เช่า*, เบอร์โทร, วันย้ายเข้า, ค่าเช่า, เฟอร์, มัดจำ, ไฟเริ่มต้น, น้ำเริ่มต้น
- `_ciRoomId`, `_ciId` state variables
- `startCheckIn(roomId, id)`: reset fields, วันย้ายเข้า default = today (dd/MM/yyyy), เปิด modal
- `ci-btn-confirm` handler: validate ชื่อต้องไม่ว่าง → เรียก `updateRoomInfo()` → อัปเดต `S.allRooms` + re-render
- Cancel + backdrop click → ปิด modal + clear state
- Backend ไม่มีการเปลี่ยนแปลง (ใช้ `updateRoomInfo()` ที่มีอยู่แล้ว)

---

## 2026-06-29 (5)

### feat: admin — checkout modal + room grid tenant fields (Session 3)

**การเปลี่ยนแปลง**:
- CSS grid เพิ่มจาก 7 → 11 cols (ห้อง | ชื่อ | **เบอร์** | เช่า | เฟอร์ | **มัดจำ** | **วันย้ายเข้า** | **Note** | ไฟเริ่ม | น้ำเริ่ม | buttons); min-width 680→1100px
- `renderRoomRows()`: เพิ่ม inputs `rphone_`, `rdeposit_`, `rmovein_`, `rnote_` ในทุก row
- `saveRoomRow()`: อ่านและส่ง fields ใหม่ (phone, deposit, moveInDate, note) ไปยัง `updateRoomInfo()`
- `startCheckOut()`: เปลี่ยนจาก confirm dialog → เปิด `#modal-checkout`; เรียก `getCheckOutInfo()` แทน `getOutstandingBalance()`
- ลบ `doCheckOut()` — logic ย้ายเข้า modal confirm handler โดยตรง
- `recalcCheckOut()` (ใหม่): คำนวณยอดคืน/ขาด realtime เมื่อกรอกรายการหัก
- Modal `#modal-checkout`: แสดง ชื่อ/เบอร์/วันย้ายเข้า/มัดจำ/ยอดค้าง; กรอกหัก 2 รายการ; กด "ยืนยัน" → `checkOutRoom(roomId, deductions)` → clear rec fields รวม phone/deposit/moveInDate

---

## 2026-06-29 (4)

### feat: DataService — checkout with deductions + tenant history (Session 2)

**การเปลี่ยนแปลง**:
- `_getTenantHistorySheet()` (ใหม่): helper เปิด Sheet "ประวัติผู้เช่า"
- `getAllRoomsInfo()`: range `A6:F51` → `A6:J51`; เพิ่ม fields moveInDate, deposit, phone, note (format Date → dd/MM/yyyy)
- `updateRoomInfo()`: range `A6:F51` → `A6:J51`; รองรับ moveInDate (col 7), deposit (col 8), phone (col 9), note (col 10)
- `getCheckOutInfo(roomId)` (ใหม่): คืน name, phone, moveInDate, deposit, outstanding — สำหรับ checkout modal
- `checkOutRoom(roomId, deductions)`: เปลี่ยนจาก simple clear → อ่าน J cols, คำนวณ refund = deposit − outstanding − หัก1 − หัก2, append row ใน Sheet "ประวัติผู้เช่า", ล้าง cols 2/3/4/7/8/9 (note col 10 เก็บไว้); คืน `{ success, refund, outstanding }`

---

## 2026-06-29 (3)

### feat: SheetSetup — tenant fields G-J + ประวัติผู้เช่า sheet (Session 1)

**การเปลี่ยนแปลง**:
- `_setupSettingsSheet()`: header `A5:J5` (+4 cols: วันที่ย้ายเข้า, เงินมัดจำ, เบอร์โทรศัพท์, Note ห้อง); roomData 10 cols; column widths G-J
- `_applyRoomBanding()`: ขยาย banding จาก 6 → 10 cols
- `_setupTenantHistorySheet()` (ใหม่): header 12 cols, freeze row 1, style header สีแดง
- `setupSheets()`: สร้าง + setup Sheet "ประวัติผู้เช่า"; filter deleteSheet เก็บ 3 sheets
- `migrateAddTenantFields()` (ใหม่): migration สำหรับ Sheet ที่มีข้อมูลอยู่แล้ว — เพิ่ม G5:J5 header + banding + สร้าง Sheet "ประวัติผู้เช่า"

---

## 2026-06-29 (2)

### feat: เปลี่ยนวิธีคำนวณค่าน้ำ — All-or-nothing threshold (DataService.gs, SheetSetup.gs, admin.html, design.md)

**กฎใหม่**:
- ใช้น้ำ < 6 หน่วย → คิด `waterMin` (ขั้นต่ำ) บาทคงที่
- ใช้น้ำ ≥ 6 หน่วย → `waterUsed × rates.water` บาท
- threshold 6 hardcoded ใน `saveRecord()`

**การเปลี่ยนแปลง**:
- `SheetSetup.gs`: เพิ่ม col D `ราคาน้ำขั้นต่ำ (บาท)` ค่าเริ่มต้น 120 ทั้งตึก C และ R
- `DataService.gs`: `getRates()` อ่าน `A2:D3` คืน field `waterMin`; `saveRecord()` ใช้ logic ใหม่
- `admin.html`: บิลแสดง `"X หน่วย · ขั้นต่ำ"` เมื่อ waterUsed < 6

---

## 2026-06-29

### fix: หน้าจัดการห้อง — หลังกดบันทึก ไม่อัพเดท UI (admin.html)
**ปัญหา**: กดบันทึกในหน้า "จัดการห้อง" แล้ว badge "ว่าง" ไม่หาย, ปุ่ม "ย้ายออก" ไม่ปรากฏ/หาย, row ไม่ reflect ค่าใหม่ (ต้อง switch tab แล้วกลับมาถึงจะเห็น)

**สาเหตุ**: `saveRoomRow` success handler อัปเดต `S.allRooms` ใน memory แต่ไม่เรียก `renderRoomsTab()` ซ้ำ — DOM ยังคง HTML เก่า

**แก้ไข**: เพิ่ม `renderRoomsTab(S.allRooms)` ต่อจาก update `S.allRooms` ใน success handler (admin.html:876)

---

## 2026-06-28

### fix: NaN dashboard + สีการ์ด (DataService.gs, admin.html)
**ปัญหา**: "ยอดที่ควรเก็บ" และ "ค้างรวม" แสดง NaN บาท และการ์ด "ยอดที่ควรเก็บ" ไม่แดง

**สาเหตุ**: col M (ค้างเดือนก่อน) ใช้ Sheets formula `=IFERROR(SUMPRODUCT(...*$S:$S)...)` แต่ col S (รวม) มีสูตร `=...+M{r}+...` → **Circular Reference** Sheets คืน error object → Apps Script `getValues()` ได้ `{}` → JavaScript `0 + {} = "0[object Object]"` → `Number(...)` → NaN

**แก้ไข**:
- `saveRecord`: เปลี่ยนจาก `setFormula(prevBalanceFormula)` → `setValue(prevBalance)` โดยคำนวณ `max(0, prevTotal - prevPaid)` ใน Apps Script ก่อนเขียน Sheet (ตัด circular ref)
- เพิ่ม `_getNextMonth()` helper
- `updatePayment`: หลัง update payment ให้หาแถวเดือนถัดไป แล้ว refresh col 13 (prevBalance) ด้วย — รักษา dynamic behavior
- `admin.html`: "ยอดที่ควรเก็บ" ใช้ `color: totalPending > 0 ? 'red' : 'green'` (แดงเมื่อยังค้าง, เขียวเมื่อเก็บครบ)

---

### feat: ห้องว่าง + ย้ายออก (DataService.gs, admin.html)

**ฟีเจอร์ที่เพิ่ม**:
1. Dashboard stat cards ใหม่: ห้องทั้งหมด / มีผู้เช่า / ว่าง (นับจาก Sheet "ตั้งค่า" จริง)
2. "ยังไม่กรอกมิเตอร์" filter เฉพาะห้องที่มีผู้เช่า — ไม่นับห้องว่าง
3. Tab "จัดการห้อง": badge "ว่าง" ข้างห้องที่ชื่อผู้เช่าว่าง
4. ปุ่ม "ย้ายออก" (สีแดง) แยกจาก flow แก้ไขปกติ — confirm dialog + warn ถ้ามียอดค้าง — ล้างชื่อ+ค่าเช่า+เฟอร์นิเจอร์ใน "ตั้งค่า" เท่านั้น ไม่แตะ "บันทึก"

**แก้บักพ่วง**: `getMissingRooms` ใช้ `allData[i][0] === monthYear` ซึ่งพัง เมื่อ Sheets auto-convert เป็น Date — เปลี่ยนเป็น `_toMonthYear()` เหมือน `getDashboardData`

**นิยาม "ห้องว่าง"**: `ชื่อผู้เช่า === ""` ใน Sheet "ตั้งค่า" (derive ณ query time ไม่ใช่ field แยก)

**Commit**: `e1def17`

---

### fix: duplicate meter rows (DataService.gs)
**ปัญหา**: บันทึกห้องเดิมซ้ำ 2 ครั้งในเดือนเดียวกัน → ชีต "บันทึก" สร้าง 2 แถวแทนที่จะ update

**สาเหตุ**: `appendRow(["6/2026", ...])` — Google Sheets auto-convert string `"6/2026"` เป็น Date serial (เพราะ cell ใหม่ได้รับ General format ไม่ inherit column format) แล้วเมื่อ `getValues()` อ่านกลับมาเป็น Date object `_findRecordRow` เทียบ `Date === "6/2026"` ไม่เจอ → `saveRecord` และ `getRoomForMeter` คิดว่าไม่มีข้อมูลเดือนนี้ → append แถวใหม่ซ้ำ

**แก้ไข**:
- เพิ่ม `_toMonthYear(val)`: ถ้า val เป็น Date ใช้ `Utilities.formatDate(val, 'Asia/Bangkok', 'M/yyyy')` แทน `date.getMonth()` (ซึ่งใช้ UTC ทำให้เดือนผิด timezone)
- `saveRecord`: หลัง `appendRow` เพิ่ม `sheet.getRange(r,1).setNumberFormat('@').setValue(data.monthYear)` บังคับเก็บเป็น string
- `getDashboardData`: เปลี่ยน `d[0] !== monthYear` → `_toMonthYear(d[0]) !== monthYear`
- เพิ่ม `fixRecordSheetDates()` สำหรับแปลงข้อมูลเก่าที่ Column A เป็น Date → string (รันครั้งเดียวจาก editor)

**Commit**: `43b04af`

---

### fix: Column A date auto-conversion (SheetSetup.gs)
**ปัญหา**: Sheets interpret "6/2026" เป็น Date ทำให้ `_findRecordRow` ทำงานผิดพลาด

**แก้ไข**: `_setupRecordSheet` เพิ่ม `sheet.getRange('A:A').setNumberFormat('@')` เพื่อ set text format ตั้งแต่ setup (แต่ `appendRow` ยังไม่ inherit — แก้เพิ่มเติมใน fix ด้านบน)

**Commit**: `cfd6f90`

---

## ก่อนหน้า

| วันที่ | ประเภท | รายการ | Commit |
|--------|--------|--------|--------|
| — | feat | เพิ่ม admin.html + DataService สำหรับ admin | `d9e8383` |
| — | feat | เพิ่ม meter.html, timestamp col, meter fallback | `5ca99c9` |
| — | feat | เพิ่ม staff.html + getRoomForStaff backend | `3d57c9f` |
| — | feat | เพิ่ม DataService.gs และ Code.gs | `a3e4d45` |
| — | fix | ลบ named ranges ใช้ hardcoded range แทน | `750f54d` |
| — | fix | safe named range removal, fix appsscript.json | `68a8cac` |
