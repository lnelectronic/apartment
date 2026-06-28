# Changelog — App-Room

บันทึกการแก้บักและเพิ่มฟีเจอร์ใหม่ทุกครั้ง

---

## 2026-06-28

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
