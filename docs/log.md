# Changelog — App-Room

บันทึกการแก้บักและเพิ่มฟีเจอร์ใหม่ทุกครั้ง

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
