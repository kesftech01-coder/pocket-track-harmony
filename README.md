# Pocket Track Pro

Pocket Track is a fully-developed, production-ready application designed to digitize and streamline the management of student pocket money for teachers in schools across the globe. It acts as a complete financial accountability ecosystem that bridges the gap between parents, teachers, and students by leveraging mobile money platforms (such as M-Pesa) for seamless deposit tracking. The app does not handle, store, or process actual funds; it solely reads transaction notifications to provide real-time financial transparency, ensuring that the teacher's mobile money remains entirely secure and untouched.

This project was built with [Lovable](https://lovable.dev).
Here is the fully revised description, now generalized to apply to **all schools worldwide**—including **both boarding and day schools**—while keeping the powerful M-Pesa integration as the core transactional engine (since mobile money is globally relevant, and M-Pesa specifically is a leading example). All localized references have been removed or broadened.

---

# Pocket Track – Complete School Pocket Money Management System

**Pocket Track** is a fully-developed, production-ready application designed to digitize and streamline the management of student pocket money for teachers in schools across the globe. It acts as a complete financial accountability ecosystem that bridges the gap between parents, teachers, and students by leveraging mobile money platforms (such as M-Pesa) for seamless deposit tracking. The app does **not** handle, store, or process actual funds; it solely reads transaction notifications to provide real-time financial transparency, ensuring that the teacher's mobile money remains entirely secure and untouched.

## The Problem We Solve
In schools worldwide—whether boarding or day institutions—teachers often act as custodians of student pocket money. Parents send funds via mobile money transfers, and teachers manually disburse small amounts to students for meals, transport, stationery, or personal upkeep. This manual system is plagued by errors, lost records, frequent disputes over balances, and enormous administrative overhead. Parents have little to no visibility into their child's spending, and teachers spend valuable hours reconciling SMS messages with handwritten ledgers. **Pocket Track eliminates this friction** by automating balance updates and maintaining a tamper-proof, real-time digital ledger for every student, regardless of the school type.

---

## Core Features & Detailed Workflows

### 1. Secure Role-Based Authentication
- Teachers access the application via a dedicated sign-in portal that requires three credentials: **Teacher's Full Name**, **Class Assigned** (e.g., Grade 5A, Form 2B), and a **Secure Password**.
- The authentication system enforces strict role-based access, ensuring that only authorized class teachers can view and manage data pertaining to their specific class, maintaining complete data privacy and institutional security.

### 2. Comprehensive Student Dashboard
Upon successful login, the teacher is greeted with a well-organized, at-a-glance dashboard that displays a complete list of all students under their care. For every student, the dashboard surfaces:

- **Admission Number** – A unique, immutable identifier for each student.
- **Full Name** – The student's legal name for easy identification.
- **Class** – Confirms the student's current grade or stream.
- **Parent/Guardian Phone Number** – The primary mobile money registered number used for all transactions.
- **Total Pocket Money Balance** – A live, up-to-date figure representing the student's remaining funds.
- **Disbursement History** – A detailed, time-stamped log of every disbursement made to the student throughout the current term or semester, including dates, amounts, and optional notes (e.g., "Lunch," "Bus fare," "School supplies").

### 3. Automated Balance Updates via Mobile Money Integration (Read-Only)
This is the **core engine** of Pocket Track. The system integrates directly with the device's SMS inbox (or a mobile money gateway API) to read incoming transaction messages—specifically, the "Money Received" notifications from the paybill, till number, or merchant code used by the teacher.

- **Smart Matching Logic**: When a mobile money message arrives, the system extracts the sender's phone number and the amount sent. It then cross-references this number against the database of registered parents.
- **Instant Balance Reflection**: If a match is found, the student's total pocket money balance is automatically incremented by the exact amount received, and a new credit entry is appended to their disbursement history. This happens in real-time, completely eliminating manual data entry.
- **Money is Never Touched**: Crucially, the app does **not** integrate with any payment gateway or mobile money API that processes funds. It is a passive, read-only observer of SMS notifications. The money remains securely in the teacher's mobile money account at all times.

### 4. Intelligent Unrecognized Sender Alert System
Not every transaction notification will belong to a registered student. To handle this gracefully:

- If the system detects an incoming payment from a phone number that is **not** linked to any student record, it does **not** automatically create a balance.
- Instead, it immediately triggers a **prominent, non-intrusive notification** (e.g., a pop-up, dashboard banner, or push alert) on the teacher's interface.
- This notification clearly displays the unknown phone number and the amount sent, prompting the teacher to manually assign the funds to the correct student. This prevents misallocation of funds and ensures that every unit of currency is accounted for, even when parents forget to notify the teacher beforehand.

### 5. Comprehensive Admin Panel for Student Lifecycle Management
Managing a classroom is dynamic—new students join mid-term, and records need to be kept current. The application includes a dedicated **Administration Panel** accessible via the main navigation menu. Within this panel, the teacher can:

- **Register New Students**: Fill out a streamlined form with all mandatory fields: Admission Number, Student's Full Name, Class, and Parent/Guardian's Phone Number.
- **Edit Existing Records**: Update parent contact details or correct student names in case of errors.
- **Deactivate/Archive Students**: Manage rollover for students who have left the class or graduated, keeping the active roster clean.
- **Class Roster Management**: View a master list of all registered students in a sortable, searchable table for easy bulk oversight.
- The admin interface is designed to be intuitive, requiring zero technical knowledge to operate—any teacher can onboard a new student in under 30 seconds.

### 6. In-App Disbursement Logging
Teachers can instantly log cash handouts directly within the student's profile. When a teacher gives money to a student, they simply enter the amount and an optional note. The system immediately deducts the amount from the student's total balance and records the transaction in the disbursement history. This turns the app into a complete, closed-loop ledger without requiring any external tools.

---

## Tailored for Both Boarding and Day Schools

Pocket Track is designed with the unique needs of both school types in mind:

- **For Boarding Schools**: Teachers can manage larger, more frequent allowances covering meals, laundry, medical expenses, and personal items over extended terms. The detailed disbursement history provides crucial oversight for parents who are often far away.
- **For Day Schools**: Teachers can track smaller, daily disbursements for lunch, transport, and after-school activities. The real-time balance updates give parents peace of mind knowing their child has exactly what they need for the day.
- The same robust system handles both scenarios with equal efficiency, making it a truly versatile tool for any educational institution.

---

## Key Benefits for Teachers, Parents, and Schools

- **Zero Data Entry Errors**: By reading transaction messages automatically, the app removes the risk of human error associated with manual ledger entries.
- **Complete Transparency**: Teachers can show parents an accurate, itemized history of every deposit and withdrawal at any moment, building trust and reducing disputes.
- **Massive Time Savings**: What used to take 15–20 minutes of daily reconciliation is now reduced to a few seconds of glanceable verification.
- **Mobile-First & Cross-Platform**: The application is fully responsive and optimized for mobile devices, recognizing that teachers primarily use smartphones in their daily routines, while also functioning seamlessly on tablets and desktops.
- **Real-Time Accountability**: Both teachers and administrators have access to up-to-the-minute balance information, fostering a culture of financial responsibility among students.
- **Offline Resilience**: The system intelligently caches critical data, ensuring core functionality remains available even with intermittent network connectivity—a common challenge in remote and rural areas.

---

## Technical Overview

- **System Architecture**: Built on a robust, secure full-stack architecture with a decoupled client and a scalable backend API, ensuring high performance and maintainability.
- **Database**: Utilizes a secure, centralized relational database to guarantee data integrity, atomic transactions, and reliable backup recovery.
- **SMS/Notification Listener Service**: Employs a dedicated background service (or third-party gateway integration) that securely monitors incoming messages with explicit user consent, respecting all privacy regulations.
- **Security**: Implements end-to-end encryption for data in transit, salted password hashing for authentication, and strict session management to prevent unauthorized access.
- **Push Notifications**: Integrated real-time notification system to alert teachers immediately when an unrecognized payment comes in or when a successful top-up occurs.

---

## Advanced Capabilities & Future Roadmap

While the core application is fully operational and ready for deployment, the following enhancements are planned for upcoming releases:

- **Parent Portal**: A dedicated web or USSD interface where guardians can view their child's remaining balance, review spending history, and receive low-balance alerts.
- **Term-Based Financial Reports**: Automated generation of downloadable PDF or Excel summaries for end-of-term financial reconciliation with school administration.
- **Multi-Teacher Collaboration**: Support for deputy teachers or class assistants to have view-only or limited edit access to the roster.
- **Bulk SMS Notifications**: Ability for teachers to send group SMS reminders to parents regarding low balances or upcoming school events directly through the app.

---

**Pocket Track is more than just software—it is a practical, human-centered solution to a universal logistical challenge faced by educators in boarding and day schools around the world. It puts financial clarity back into the hands of teachers, allowing them to focus on what truly matters: educating the next generation.**

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac2acd8f-ed9b-4c12-a2eb-2759b1d18c99).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
