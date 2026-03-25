# Database Schema to Google Sheets Inspector

เครื่องมือสำหรับดึงโครงสร้างฐานข้อมูล (Schema) จาก SQL (MariaDB, PostgreSQL) หรือ NoSQL (MongoDB) และส่งข้อมูลไปยัง Google Sheets โดยอัตโนมัติ

## ฟีเจอร์หลัก
- รองรับ SQL Dialects: MariaDB, MySQL, และ PostgreSQL
- รองรับ NoSQL: MongoDB
- ส่งข้อมูลไปยัง Google Sheets ผ่าน Google Apps Script (GAS)
- ระบบ Auto-Run: รันสคริปต์แล้วดึงข้อมูลส่ง Google Sheets ทันที
- จัดรูปแบบตารางใน Google Sheets ให้อัตโนมัติ (ใส่สี, Checkbox, Dropdown)

---

## 1. การตั้งค่า Google Apps Script (GAS)

เพื่อให้สคริปต์ส่งข้อมูลไปยัง Google Sheets ได้ คุณต้องตั้งค่า GAS ดังนี้:

1. **สร้าง Google Sheet ใหม่**: สร้างไฟล์ Google Sheet ที่คุณต้องการรวบรวมข้อมูล
2. **เปิด Apps Script**: ไปที่เมนู `Extensions` > `Apps Script`
3. **คัดลอกโค้ด**: คัดลอกเนื้อหาจากไฟล์ `app-script.js` ในโปรเจกต์นี้ ไปวางแทนที่ในหน้าต่าง Apps Script
4. **แก้ไข Spreadsheet ID**: ใน `app-script.js` บรรทัดที่ 3 ให้เปลี่ยน `XXXXX` เป็น ID ของ Google Sheet ของคุณ (ดูได้จาก URL ของ Sheet ระหว่าง `/d/` และ `/edit`)
5. **การ Deploy (ติดตั้งใช้งาน)**:
   - กดปุ่ม `Deploy` > `New Deployment`
   - เลือกหัวข้อ `Web App`
   - ตั้งค่า `Execute as`: **Me**
   - ตั้งค่า `Who has access`: **Anyone**
   - กด `Deploy` และคัดลอก **Web App URL** ที่ได้มา (เช่น `https://script.google.com/macros/s/.../exec`)

---

## 2. การตั้งค่าในเครื่อง (Local Setup)

1. **ติดตั้ง Dependencies**:
   ```bash
   npm install
   ```

2. **สร้างไฟล์ .env**:
   คัดลอกไฟล์ `.env.example` เป็น `.env` และกรอกข้อมูลการเชื่อมต่อฐานข้อมูลของคุณ
   ```bash
   cp .env.example .env
   ```

3. **กรอก Google Sheet Key**:
   ในไฟล์ `.env` ตรงช่อง `GOOGLE_SHEET_KEY` ให้เอาเฉพาะ **Deployment ID** จาก Web App URL ที่ได้ในข้อ 1.5 มาใส่ (ส่วนที่อยู่ระหว่าง `/s/` และ `/exec`)

---

## 3. การรันสคริปต์ (Running the Scripts)

คุณสามารถเลือกการรันได้หลายรูปแบบตามประเภทฐานข้อมูล:

### สำหรับ SQL (MariaDB / PostgreSQL)
- **รัน MariaDB ทันที**:
  ```bash
  npm run inspect:mariadb
  ```
- **รัน PostgreSQL ทันที**:
  ```bash
  npm run inspect:pg
  ```
- **รันตามค่าใน .env**:
  ```bash
  npm run inspect:sql
  ```

### สำหรับ NoSQL (MongoDB)
- **รันทันที**:
  ```bash
  npm run inspect:no-sql
  ```

### การรันแบบเฝ้าดูการเปลี่ยนแปลง (Development)
หากต้องการรัน Server ไว้และเรียกผ่าน Browser หรือ Curl:
- `npm run dev:sql` (สำหรับ SQL)
- `npm run dev:no-sql` (สำหรับ NoSQL)
จากนั้นเรียกไปที่: `http://localhost:7777/inspect`

---

## หมายเหตุ
- หากใช้ **PostgreSQL**: ตรวจสอบให้แน่ใจว่าได้ระบุ `DB_DIALECT=postgres` ใน `.env`
- **AUTO_RUN**: หากตั้งค่าเป็น `true` ใน `.env`, สคริปต์จะเริ่มทำงานทันทีที่สั่งรัน `node`
- **cross-env**: โปรเจกต์นี้ใช้ `cross-env` เพื่อให้สามารถรันคำสั่งกำหนด Environment Variables ได้ทั้งบน Windows และ Linux
