# Bug Log

| ID | วันที่ | คำอธิบาย | สถานะ | การแก้ไข |
|----|--------|-----------|--------|----------|
| B001 | 2026-06-28 | บันทึก record ซ้ำได้ (duplicate row) + มิเตอร์เริ่มแสดงค่า fallback แทนเดือนก่อน เพราะ `_findRecordRow` compare `Date === string` ไม่ผ่าน | FIXED | เพิ่ม `_toMonthYear()` normalize Date→"M/YYYY" ก่อน compare ใน `DataService.gs` |
| B002 | 2026-06-28 | Dashboard "ยอดที่ควรเก็บ" และ "ค้างรวม" แสดง NaN — col M (ค้างเดือนก่อน) ใช้ Sheets formula `$S:$S` แต่ col S มี `+M{r}` → Circular Reference → Sheets error → JSON `{}` → JS NaN | FIXED | เปลี่ยน col 13 เป็น static value คำนวณใน Apps Script; `updatePayment` refresh prevBalance เดือนถัดไปด้วย |
