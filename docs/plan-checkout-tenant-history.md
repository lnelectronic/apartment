# Plan: Checkout Flow + Tenant History + Room Fields

## สถานะ: ยังไม่เริ่ม (Session 1 พร้อมทำ)

---

## Feature ที่ต้องทำ (ตัดสินใจแล้ว)

### 1. Sheet "ตั้งค่า" — เพิ่ม col ใหม่ (G–J)

| col | ชื่อ | ผูกกับ | ล้างตอน checkout |
|-----|------|--------|-----------------|
| G | วันที่ย้ายเข้า | ผู้เช่า | ✓ |
| H | เงินมัดจำ | ผู้เช่า | ✓ |
| I | เบอร์โทรศัพท์ | ผู้เช่า | ✓ |
| J | Note ห้อง | ห้อง | ✗ (เก็บไว้) |

### 2. Sheet ใหม่ "ประวัติผู้เช่า"

Columns: เลขห้อง, ชื่อผู้เช่า, เบอร์โทร, วันย้ายเข้า, วันย้ายออก, เงินมัดจำ, หัก-1 รายการ, หัก-1 จำนวน, หัก-2 รายการ, หัก-2 จำนวน, ยอดค้าง, ยอดคืน/ขาด

- ดูผ่าน Google Sheets โดยตรง (ไม่ต้องทำ tab ใน admin.html)

### 3. Checkout Modal ใหม่ (แทน confirm dialog เดิม)

Flow: กด "ย้ายออก" → modal แสดง:
- ชื่อผู้เช่า + เบอร์ + วันย้ายเข้า
- ยอดค้างรวมทุกเดือน (ดึงอัตโนมัติ)
- เงินมัดจำ (ดึงจาก ตั้งค่า)
- ช่องกรอก: รายการหัก 1–2 (ชื่อ + จำนวน)
- คำนวณ: **ยอดคืน = มัดจำ − ยอดค้าง − รายการหัก**
- ปุ่ม "ยืนยันย้ายออก" → บันทึก ประวัติผู้เช่า → ล้างข้อมูลห้อง

### 4. Room Grid ใน admin.html — เพิ่ม fields ใหม่

Grid ใหม่: ห้อง | ชื่อ | เบอร์ | เช่า | เฟอร์ | มัดจำ | วันย้ายเข้า | Note | ไฟเริ่ม | น้ำเริ่ม | [buttons]

---

## แผนแบ่ง Session

### Session 1 — SheetSetup.gs (Backend Structure)
**ไฟล์:** `src/SheetSetup.gs`

**งาน:**
1. `_setupSettingsSheet()`:
   - เปลี่ยน room header จาก `A5:F5` → `A5:J5`
   - เพิ่ม header: วันที่ย้ายเข้า, เงินมัดจำ, เบอร์โทรศัพท์, Note ห้อง
   - เพิ่ม room data 10 cols (G–J เป็นค่าว่าง)
   - อัป `_applyRoomBanding()` ให้ครอบ 10 cols
   - อัป column width col G–J

2. เพิ่ม `_setupTenantHistorySheet(sheet)`:
   - headers: เลขห้อง, ชื่อผู้เช่า, เบอร์โทร, วันย้ายเข้า, วันย้ายออก, เงินมัดจำ, หัก-1 รายการ, หัก-1 จำนวน, หัก-2 รายการ, หัก-2 จำนวน, ยอดค้าง, ยอดคืน/ขาด
   - freeze row 1, style header

3. อัป `setupSheets()`:
   - เพิ่ม `var histSheet = ss.getSheetByName('ประวัติผู้เช่า') || ss.insertSheet('ประวัติผู้เช่า');`
   - เพิ่ม `_setupTenantHistorySheet(histSheet);`
   - อัปเดต comment จำนวนห้อง (47 ห้อง)

4. เพิ่ม `migrateAddTenantFields()`:
   - ตรวจ col G1 — ถ้ามีแล้วให้ข้าม
   - เพิ่ม header G1:J1 ใน ตั้งค่า
   - สร้าง Sheet "ประวัติผู้เช่า" ถ้ายังไม่มี แล้วเรียก `_setupTenantHistorySheet()`
   - อัป banding ใหม่ (10 cols)

**เมื่อเสร็จ:** clasp push + commit `feat: SheetSetup — tenant fields G-J + ประวัติผู้เช่า sheet`

---

### Session 2 — DataService.gs (Backend Logic)
**ไฟล์:** `src/DataService.gs`
**ต้องทำ Session 1 ก่อน**

**งาน:**
1. `getAllRoomsInfo()`:
   - เปลี่ยน range `A6:F51` → `A6:J51`
   - เพิ่ม fields ใน return object:
     ```
     moveInDate: r[6] instanceof Date
       ? Utilities.formatDate(r[6], 'Asia/Bangkok', 'dd/MM/yyyy') : (r[6] || ''),
     deposit:    r[7] || 0,
     phone:      r[8] || '',
     note:       r[9] || ''
     ```

2. `updateRoomInfo()`:
   - เปลี่ยน range `A6:D51` → `A6:J51`  (ใน checkOutRoom ก็ด้วย)
   - เพิ่มใน loop:
     ```
     if (info.moveInDate !== undefined) sheet.getRange(r, 7).setValue(info.moveInDate);
     if (info.deposit    !== undefined) sheet.getRange(r, 8).setValue(info.deposit);
     if (info.phone      !== undefined) sheet.getRange(r, 9).setValue(info.phone);
     if (info.note       !== undefined) sheet.getRange(r, 10).setValue(info.note);
     ```

3. เพิ่ม `getCheckOutInfo(roomId)`:
   ```javascript
   function getCheckOutInfo(roomId) {
     var data = _getSettingsSheet().getRange('A6:J51').getValues();
     for (var i = 0; i < data.length; i++) {
       if (data[i][0] !== roomId) continue;
       var moveInDate = data[i][6] instanceof Date
         ? Utilities.formatDate(data[i][6], 'Asia/Bangkok', 'dd/MM/yyyy') : (data[i][6] || '');
       return {
         name:       data[i][1] || '',
         phone:      data[i][8] || '',
         moveInDate: moveInDate,
         deposit:    data[i][7] || 0,
         outstanding: getOutstandingBalance(roomId).outstanding
       };
     }
     throw new Error('ไม่พบห้อง ' + roomId);
   }
   ```

4. เพิ่ม `_getTenantHistorySheet()` helper:
   ```javascript
   function _getTenantHistorySheet() {
     var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('ประวัติผู้เช่า');
     if (!sheet) throw new Error('ไม่พบ Sheet "ประวัติผู้เช่า"');
     return sheet;
   }
   ```

5. อัป `checkOutRoom(roomId, deductions)`:
   ```javascript
   function checkOutRoom(roomId, deductions) {
     var sheet = _getSettingsSheet();
     var data  = sheet.getRange('A6:J51').getValues();
     var rowIndex = -1, name = '', moveInDate = '', deposit = 0, phone = '';
     for (var i = 0; i < data.length; i++) {
       if (data[i][0] !== roomId) continue;
       rowIndex   = i + 6;
       name       = data[i][1];
       moveInDate = data[i][6];
       deposit    = data[i][7] || 0;
       phone      = data[i][8] || '';
       break;
     }
     if (rowIndex === -1) throw new Error('ไม่พบห้อง ' + roomId);

     var outstanding   = getOutstandingBalance(roomId).outstanding;
     var d1 = (deductions && deductions.deduct1Amount) || 0;
     var d2 = (deductions && deductions.deduct2Amount) || 0;
     var refund = deposit - outstanding - d1 - d2;

     // บันทึก ประวัติผู้เช่า
     _getTenantHistorySheet().appendRow([
       roomId, name, phone,
       moveInDate, new Date(),
       deposit,
       (deductions && deductions.deduct1Name) || '', d1,
       (deductions && deductions.deduct2Name) || '', d2,
       outstanding, refund
     ]);

     // ล้างข้อมูลผู้เช่า (ไม่แตะ col J = note)
     sheet.getRange(rowIndex, 2).setValue('');   // ชื่อ
     sheet.getRange(rowIndex, 3).setValue(0);    // ค่าเช่า
     sheet.getRange(rowIndex, 4).setValue(0);    // เฟอร์
     sheet.getRange(rowIndex, 7).setValue('');   // วันย้ายเข้า
     sheet.getRange(rowIndex, 8).setValue(0);    // มัดจำ
     sheet.getRange(rowIndex, 9).setValue('');   // เบอร์
     SpreadsheetApp.flush();
     return { success: true, refund: refund, outstanding: outstanding };
   }
   ```

**เมื่อเสร็จ:** clasp push + commit `feat: DataService — checkout with deductions + tenant history`

---

### Session 3 — admin.html (Frontend)
**ไฟล์:** `src/admin.html`
**ต้องทำ Session 1+2 ก่อน**

**งาน:**

#### 3a. Room Grid — เพิ่ม cols ใหม่

Header HTML (เปลี่ยน 2 จุด สำหรับ rooms-c และ rooms-r):
```html
<div class="room-grid-hdr">
  <div>ห้อง</div><div>ชื่อ</div><div>เบอร์</div>
  <div>เช่า</div><div>เฟอร์</div><div>มัดจำ</div>
  <div>วันย้ายเข้า</div><div>Note</div>
  <div>ไฟเริ่ม</div><div>น้ำเริ่ม</div><div></div>
</div>
```

CSS: เพิ่ม min-width จาก 680px → 1100px สำหรับ `.room-grid-hdr, .room-grid-row`

`renderRoomRows()` — เพิ่ม inputs:
```javascript
+ '<div><input id="rphone_'+id+'"  value="'+(r.phone||'')+'"  placeholder="เบอร์โทร" style="width:95px"></div>'
+ '<div><input id="rdeposit_'+id+'" type="number" value="'+(r.deposit||0)+'" style="width:70px"></div>'
+ '<div><input id="rmovein_'+id+'"  value="'+(r.moveInDate||'')+'" placeholder="dd/MM/yyyy" style="width:95px"></div>'
+ '<div><input id="rnote_'+id+'"    value="'+(r.note||'')+'"    placeholder="Note" style="width:120px"></div>'
```

`saveRoomRow()` — เพิ่ม:
```javascript
var phone      = document.getElementById('rphone_'   + id).value.trim();
var deposit    = parseFloat(document.getElementById('rdeposit_' + id).value) || 0;
var moveInDate = document.getElementById('rmovein_'  + id).value.trim();
var note       = document.getElementById('rnote_'    + id).value.trim();
```
และส่ง `.updateRoomInfo(roomId, { name, rent, furniture, elecInit, waterInit, phone, deposit, moveInDate, note })`

`doCheckOut` success — เพิ่ม clear fields:
```javascript
rec.phone = ''; rec.deposit = 0; rec.moveInDate = '';
```

#### 3b. Checkout Modal

เพิ่ม HTML modal `#modal-checkout` (คล้าย #modal-bill):
```html
<div id="modal-checkout" hidden>
  <div class="modal-box">
    <div class="bill-header">
      <div class="bill-title">ย้ายออก</div>
      <div id="co-meta" class="bill-meta"></div>
    </div>
    <hr class="bill-dashed">
    <div id="co-body"></div>
    <div style="margin-top:16px">
      <div style="margin-bottom:8px;font-weight:600">รายการหัก</div>
      <div style="display:flex;gap:8px;margin-bottom:6px">
        <input id="co-d1name" placeholder="รายการ เช่น ค่าทำความสะอาด" style="flex:1">
        <input id="co-d1amt"  type="number" placeholder="จำนวน" style="width:90px">
      </div>
      <div style="display:flex;gap:8px">
        <input id="co-d2name" placeholder="รายการ เช่น ค่าของเสียหาย" style="flex:1">
        <input id="co-d2amt"  type="number" placeholder="จำนวน" style="width:90px">
      </div>
    </div>
    <div id="co-result" class="bill-total" style="margin-top:16px"></div>
    <div id="co-msg" class="alert" style="display:none;margin-top:8px"></div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button id="co-btn-confirm" class="btn btn-danger" style="flex:1">ยืนยันย้ายออก</button>
      <button id="co-btn-cancel"  class="btn btn-ghost">ยกเลิก</button>
    </div>
  </div>
</div>
```

JS — แทน `startCheckOut()`:
- เรียก `getCheckOutInfo(roomId)` แทน `getOutstandingBalance`
- เปิด `#modal-checkout` แสดง: ชื่อ, เบอร์, วันย้ายเข้า, ยอดค้าง, มัดจำ
- bind input change → recalculate ยอดคืน แบบ realtime
- กด "ยืนยัน" → เรียก `checkOutRoom(roomId, {deduct1Name, deduct1Amount, deduct2Name, deduct2Amount})`
- success → ปิด modal + re-render rooms

**เมื่อเสร็จ:** clasp push + commit `feat: admin — checkout modal + room grid tenant fields`

---

## Context สำคัญสำหรับทุก Session

- clasp push รันจาก root (`/home/ln/workspace/App-Room`)
- Git commit: **ห้ามใส่ Co-Authored-By Claude** — ใช้ `git commit -m "..."` ธรรมดา
- อ่าน `design.md` ก่อนเสมอ
- Sheet "ตั้งค่า" range ปัจจุบัน: rates = `A2:D3`, rooms = `A6:F51` (หลัง migration จะเป็น `A6:J51`)
- 47 ห้อง (C: 19, R: 28)
- บันทึกลง `docs/log.md` ทุกครั้งที่เสร็จ session
- อัปเดต status ใน file นี้ (บรรทัดแรก) ให้ตรงกับ session ที่เสร็จแล้ว
