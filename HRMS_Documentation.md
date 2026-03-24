# Smalsus – HR Management Portal
### Application Documentation

> **Platform:** SharePoint-based Web Application (Microsoft 365)  
> **URL:** `https://hhhhteams.sharepoint.com/sites/HHHH/SP/SitePages/HRMS.aspx`  
> **Purpose:** Centralized HR Management System for attendance tracking, leave management, salary slips, employee directory, and HR administration.

---

## Table of Contents

1. [Application Overview](#1-application-overview)
2. [Navigation & Layout](#2-navigation--layout)
3. [Employee View](#3-employee-view)
   - [Dashboard](#31-dashboard)
   - [Attendance](#32-attendance)
   - [Leave Applications](#33-leave-applications)
   - [Work From Home (WFH)](#34-work-from-home-wfh)
   - [Salary Slip](#35-salary-slip)
4. [HR Admin View](#4-hr-admin-view)
   - [Dashboard](#41-dashboard)
   - [Leaves Request](#42-leaves-request)
   - [WFH Request](#43-wfh-request)
   - [Global Directory](#44-global-directory)
   - [Global Attendance](#45-global-attendance)
   - [Upload Salary Slip](#46-upload-salary-slip)
   - [On Leave / WFH Today](#47-on-leave--wfh-today)
   - [Leave Policy](#48-leave-policy)
   - [Official Leaves](#49-official-leaves)
   - [Carry Forward Leaves](#410-carry-forward-leaves)
   - [Concerns](#411-concerns)
5. [User Profile](#5-user-profile)
6. [Navigation Summary Table](#6-navigation-summary-table)

---

## 1. Application Overview

The **Smalsus – HR Management Portal** is a SharePoint-integrated HRMS application built for internal employee and HR administration. It is embedded into the organisation's SharePoint intranet and provides two distinct role-based views:

| View | Purpose |
|------|---------|
| **Employee View** | Personal attendance, leave requests, WFH requests, and salary slips |
| **HR Admin View** | Organisation-wide management: directories, approvals, attendance, payroll, policies |

The application is accessed via the SharePoint top navigation bar alongside other tools such as **Operational Management Tool**, **PXC Portfolio**, **CSF Portfolio**, **Tools**, **Timesheets**, **Subsites**, **Admin**, **Quick Access**, **AI Solutions**, and **OOTB Search**.

---

## 2. Navigation & Layout

### Header Bar

![Application Header - User Profile View](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/user_profile_1773986689275.png)
*Application header showing the "Smalsus – HR Management Portal" title, Employee/HR Admin toggle, and user profile avatar (AD)*

| Element | Description |
|---------|-------------|
| **Application Title** | "Smalsus – HR Management Portal" with a portal icon |
| **View Toggle** | Two buttons: `Employee` (outlined) and `HR Admin` (filled/active) — switches the entire navigation set |
| **User Avatar** | Circular icon showing user initials (e.g., "AD") — clicking opens the User Profile page |

### SharePoint Top Navigation
The application sits within the full SharePoint navigation bar with links to:
`SP Home` · `Operational Management Tool ▾` · `PXC Portfolio ▾` · `CSF Portfolio ▾` · `Tools ▾` · `Timesheets ▾` · `Subsites ▾` · `Admin ▾` · `Quick Access ▾` · `AI Solutions` · `OOTB Search`

---

## 3. Employee View

The Employee View provides personal HR self-service features. Tabs are displayed horizontally below the header.

**Tabs available:** `Dashboard` · `Attendance` · `Leave Applications` · `Work From Home` · `Salary Slip`

---

### 3.1 Dashboard

![Employee Dashboard](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_dashboard_1773986435827.png)
*Employee Dashboard showing personalised widgets and leave balance*

**Purpose:** Personal overview and quick access to HR information.

#### Widgets / Cards

| Widget | Description |
|--------|-------------|
| **Low Working Hours** | Lists attendance records where total hours were less than 9h for the day |
| **On Leave / WFH Today** | Shows colleagues who are currently on leave or working remotely, with their reason |
| **Leave Balance** | Displays counters for **RH** (Restricted Holidays), **Planned**, and **Unplanned** leaves remaining. Includes a "View Leave Policy" link |
| **Team Celebrations** | Upcoming team birthdays or anniversaries |
| **Upcoming Holidays** | Displays official public/gazetted holidays for the current month |
| **Recent Attendance** | Quick summary of the last few punch-in/out records |

**Greeting:** Personalised "Welcome, [User Name]!" message at the top.

---

### 3.2 Attendance

![Employee Attendance](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_attendance_1773986447007.png)
*Employee Attendance tab showing table and calendar views with clock-in/out records*

**Purpose:** View personal attendance records across different time periods.

#### Sub-tabs / Views

| Sub-tab | Description |
|---------|-------------|
| **Daily** | Attendance for a single date |
| **Weekly** (default) | Attendance for the current/selected week |
| **Monthly** | Attendance for a full month |

#### View Modes

| Mode | Description |
|------|-------------|
| **Table View** | Tabular list of attendance records |
| **Calendar View** | Visual calendar marking attendance status (e.g., "Present", holiday labels) |

#### Table Columns (Table View)

| Column | Description |
|--------|-------------|
| **Date** | The date of the attendance record |
| **Work Status** | Status label (e.g., Present, Absent, Holiday) |
| **Clock In** | Time the employee punched in |
| **Clock Out** | Time the employee punched out |
| **Total Working Hours** | Computed duration of work |
| **Action** | `Raise Concern` button per row — opens a concern submission form |

#### Controls & Features
- **Previous / Next** navigation arrows for date range
- **Search bar** for filtering records
- **SmartTable settings** icon for display configuration

---

### 3.3 Leave Applications

![Employee Leave Applications](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_leaves_1773986457409.png)
*Leave Applications tab showing leave history table*

**Purpose:** View leave history and submit new leave requests.

#### Toolbar Buttons
| Button | Action |
|--------|--------|
| **New Request** | Opens the New Leave Request modal |

#### History Table Columns

| Column | Description |
|--------|-------------|
| **Duration** | Start date → End date of the leave |
| **Type** | Leave category: `Planned`, `Unplanned`, `RH` (Restricted Holiday), `Maternity`, `Paternity` |
| **Days** | Number of days taken |
| **Status** | Current state: `Pending` / `Approved` / `Rejected` |
| **HR Message** | Optional message from HR on approval/rejection |
| **Action** | `Raise Concern` button |

#### New Leave Request Modal

![New Leave Request Modal](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_leave_modal_1773986467554.png)
*New Leave Request dialog with all input fields*

| Field | Type | Description |
|-------|------|-------------|
| **Leave Type** | Dropdown | Options: Planned Leave, Unplanned Leave, Restricted Holiday (RH), Maternity Leave, Paternity Leave |
| **Start Date** | Date picker | First day of the leave |
| **End Date** | Date picker | Last day of the leave |
| **Request Half Day** | Toggle | If enabled, allows selecting first or second half |
| **Recurrence** | Toggle | For repeating leave patterns |
| **Reason** | Textarea | Free-text explanation for the leave |

**Modal Buttons:** `Submit` · `Cancel`

---

### 3.4 Work From Home (WFH)

![Employee WFH](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_wfh_1773986485654.png)
*Work From Home tab showing WFH request history*

**Purpose:** View WFH history and submit new WFH requests.

#### Toolbar Buttons
| Button | Action |
|--------|--------|
| **New Request** | Opens the New WFH Request modal |

#### History Table Columns

| Column | Description |
|--------|-------------|
| **Duration** | Start → End dates |
| **Type** | WFH category type |
| **Days** | Number of days |
| **Status** | `Pending` / `Approved` / `Rejected` |
| **HR Message** | HR feedback on the request |
| **Action** | `Raise Concern` button |

#### New WFH Request Modal

Identical structure to the Leave Request modal with fields for:
- **WFH Type** (Dropdown)
- **Start Date** / **End Date**
- **Request Half Day** (Toggle)
- **Recurrence** (Toggle)
- **Reason** (Textarea)

**Modal Buttons:** `Submit` · `Cancel`

---

### 3.5 Salary Slip

![Employee Salary Slip](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/employee_salary_1773986497774.png)
*Salary Slip tab showing payslip history with download option*

**Purpose:** View personal payslip records and download salary slips.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Pay Period** | The month/year of the salary slip |
| **Basic Salary** | Base pay amount |
| **Total Deductions** | PF, ESI, Tax, and other deductions |
| **Net Paid** | Final take-home amount |
| **Actions** | `Download Slip` button to download PDF · `Raise Concern` for payroll disputes |

---

## 4. HR Admin View

The HR Admin View is accessible to authorized HR personnel. It provides organisation-wide management tools.

**Tabs available (Row 1):** `Dashboard` · `Leaves Request` · `WFH Request` · `Global Directory` · `Global Attendance` · `Upload Salary Slip` · `On Leave / WFH Today` · `Leave Policy` · `Official Leaves`

**Tabs available (Row 2):** `Carry Forward Leaves` · `Concerns`

---

### 4.1 Dashboard

![HR Admin Dashboard](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_dashboard_1773986511454.png)
*HR Admin Dashboard with organisational statistics, charts, and team events*

**Purpose:** Organisation-wide HR overview with key metrics, charts, and pending actions.

#### Statistics Cards

| Card | Description |
|------|-------------|
| **Present Today** | Count of employees present |
| **On Leave Today** | Count of employees on leave |
| **Leave Requests** | Number of pending leave applications |
| **Raised Concerns** | Number of open employee concerns |
| **Approved Requests** | Count of approved requests |
| **Total Requests** | Total leave/WFH requests in system |

#### Charts
| Chart | Description |
|-------|-------------|
| **Approved Leave Days by Type** | Visual breakdown of leave distribution by category |
| **Leave Requests by Department** | Department-wise leave request overview |

#### Action Buttons
| Button | Action |
|--------|--------|
| **Generate Weekly Report** | Generates a weekly attendance/leave report |
| **Add Event** | Adds team celebration event (birthday/anniversary) |

---

### 4.2 Leaves Request

![HR Admin Leaves Request](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_leaves_1773986524117.png)
*HR Admin Leaves Request tab with employee leave applications pending approval*

**Purpose:** Review and process all employee leave applications.

#### Filters
| Filter | Options |
|--------|---------|
| **Date Range** | Custom from/to date picker |
| **Status** | `Pending` / `Approved` / `Rejected` |

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee Name** | Name and avatar of the applicant |
| **Duration** | Start → End date of the leave |
| **Type** | Leave category |
| **Days** | Number of days |
| **Reason** | Employee's reason for leave |
| **Action** | `Approve` button · `Reject` button |

> [!NOTE]
> The Approve and Reject actions are HR-only and directly update the employee's leave status in the system.

---

### 4.3 WFH Request

![HR Admin WFH Request](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_wfh_1773986535960.png)
*HR Admin WFH Request tab with department-grouped employees and their WFH requests*

**Purpose:** Review and approve/reject Work From Home applications.

#### Special UI Features
- **Avatar groups** by Department (e.g., SPFx Team, HR Team) showing employee thumbnails
- Department-wise visual grouping for quick overview

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee** | Name and avatar |
| **Type** | WFH type/category |
| **Dates & Duration** | From/to dates and number of days |
| **Reason** | Employee justification |
| **Status** | Current approval status |
| **Actions** | `Approve` · `Reject` |

---

### 4.4 Global Directory

![Global Directory](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_directory_1773986561398.png)
*Global Directory showing all employees with their details and status*

**Purpose:** Master list of all employees in the organisation.

#### Toolbar Buttons
| Button | Action |
|--------|--------|
| **Add User** | Opens the Add Employee modal (4-tab form) |
| **Export to Excel** | Downloads the directory as an Excel file |

#### Table Columns

| Column | Description |
|--------|-------------|
| **Name** | Employee full name |
| **Emp ID** | Unique employee identifier (e.g., S-1078) |
| **Email** | Corporate email address |
| **Department** | Team/department name |
| **Designation** | Job title |
| **DOJ** | Date of Joining |
| **Status** | `Active` / `Ex-Staff` with color badge |
| **Actions** | Edit/View actions per employee record |

#### Add User Modal (4 Tabs)

| Tab | Fields |
|-----|--------|
| **Professional Details** | Full Name, Employee ID, Email, Department (dropdown), Designation, Date of Joining, Employee Status |
| **Banking Details** | PAN Number, UAN Number, Bank Name, Account Number, IFSC Code |
| **Profile Image** | Upload profile photo |
| **Salary Details** | Yearly CTC, Salary Bonus, Insurance, Basic Pay, HRA, Allowances |

**Modal Buttons:** `Save Employee` · `Cancel`

---

### 4.5 Global Attendance

![Global Attendance](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_attendance_1773986575740.png)
*Global Attendance tab with organisation-wide clock-in/out records and filters*

**Purpose:** Monitor and manage attendance across the entire organisation.

#### Sub-tabs

| Sub-tab | Description |
|---------|-------------|
| **Date** | Attendance for a specific date |
| **Weekly** | Week-range attendance view |
| **Monthly** | Full month view with leave summaries |

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee** | Employee name and avatar |
| **Department** | Team name |
| **Date** | Attendance date |
| **Clock In** | Time of first punch-in |
| **Clock Out** | Time of last punch-out |
| **Total Time** | Total hours worked |
| **Status** | Present / Absent / Leave / Half Day |
| **Total Leave Left** | Remaining leave quota |
| **Leaves This Month** | Leaves consumed in the current month |

#### Toolbar Actions

| Button | Action |
|--------|--------|
| **Import Attendance** | Bulk import attendance data via Excel |
| **Export Attendance** | Download attendance data as Excel/CSV |
| **Delete Attendance By Date** | Remove attendance records for a specific date |
| **Generate Report** | Generate employee-wise attendance report |

> [!IMPORTANT]
> The "Delete Attendance By Date" action is permanent. Only authorised HR admins can perform this action.

---

### 4.6 Upload Salary Slip

![Upload Salary Slip](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_salary_1773986590921.png)
*Upload Salary Slip tab with employee list and salary upload modal*

**Purpose:** Generate and upload monthly salary slips for all employees.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Name** | Employee full name |
| **ID** | Employee ID |
| **Dept** | Department name |
| **Designation** | Job role |
| **Actions** | `Salary Slip` button — opens the upload/generate modal |

#### Salary Slip Upload Modal

| Field | Description |
|-------|-------------|
| **Month** | Target month for the salary slip |
| **Year** | Target year |
| **Working Days** | Total working days in the month |
| **Paid Days** | Actual days paid |
| **Yearly CTC** | Annual Cost to Company |
| **Manual Edit** | Toggle to enable manual override of calculated values |
| **Basic Pay** | Base salary component |
| **HRA** | House Rent Allowance |
| **Allowances** | Other allowances |
| **Deductions** | Deductions (tax, etc.) |
| **Gross** | Gross pay before deductions |
| **Employer PF** | Employer's Provident Fund contribution |
| **Employee PF** | Employee's Provident Fund deduction |
| **Bonus** | Performance/statutory bonus |
| **ESI** | Employee State Insurance |
| **Insurance** | Health/life insurance deduction |
| **Total Net Pay** | *(Auto-calculated)* Final take-home salary |

---

### 4.7 On Leave / WFH Today

![On Leave / WFH Today](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_onleave_1773986604478.png)
*On Leave / WFH Today tab showing real-time employee absence list*

**Purpose:** Real-time view of all employees currently on leave or working from home.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee** | Employee name |
| **Department** | Team/department |
| **Request Type** | Leave or WFH |
| **From** | Start date |
| **Until** | End date |
| **Duration** | Number of days |

#### Toolbar Actions

| Button | Action |
|--------|--------|
| **Send Report** | Emails a summary report of today's absences |
| **Add Employee Leave/WFH** | Manually add a leave/WFH record on behalf of an employee |

---

### 4.8 Leave Policy

![Leave Policy](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_policy_1773986618162.png)
*Leave Policy tab showing configurable policy documents*

**Purpose:** Maintain and configure HR policy documents visible to employees.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Policy Title** | Name of the policy (e.g., "Leave Entitlement", "Late Arrival") |
| **Description** | Full policy text |
| **Last Updated** | Timestamp of the last modification |
| **Actions** | `Edit` · `Delete` |

#### Key Policies Documented
- **Leave Entitlement** — Standard 12 Planned + 6 Unplanned leaves per year
- **Late Arrival** — Office time is 10:00 AM with a 20-minute buffer
- **Holiday Policy** — Gazetted and Restricted Holiday rules

---

### 4.9 Official Leaves

![Official Leaves](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_official_leaves_1773986633016.png)
*Official Leaves tab with holiday management and leave quota configuration*

**Purpose:** Configure official holidays and set standard leave quotas for the organisation.

#### Sections

**Official Holidays**

| Column | Description |
|--------|-------------|
| **Holiday Name** | Name of the gazetted holiday (e.g., Holi, Diwali) |
| **Date** | Date of the holiday |

**Leave Quotas**

| Leave Type | Default Quota |
|------------|--------------|
| **Planned** | 12 days/year |
| **Unplanned** | 6 days/year |
| **RH (Restricted Holiday)** | Configurable |
| **Maternity** | 182 days |
| **Paternity** | 5 days |

#### Toolbar Actions

| Button | Action |
|--------|--------|
| **Add Holiday** | Add a new official holiday |
| **Add Unofficial Leave** | Add a non-standard leave type |
| **Manage Unofficial Leaves** | View/edit all unofficial leave configurations |

---

### 4.10 Carry Forward Leaves

![Carry Forward Leaves](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_carry_forward_1773986658414.png)
*Carry Forward Leaves tab with monthly leave accrual tracking*

**Purpose:** Track and manage monthly leave accrual, carry-forward balances, and manual adjustments.

#### Controls

| Control | Description |
|---------|-------------|
| **Month Selector** | Choose the month for carry-forward calculation |
| **Monthly Accrual** | Set the number of leaves accrued per month |
| **Recalculate & Save** | Trigger recalculation and persist updates |

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee Name** | Full name |
| **ID** | Employee ID |
| **Dept** | Department |
| **Leave Rule** | The leave policy rule applied |
| **Opening Balance** | Leaves at the start of the month |
| **Added This Month** | Accrued leaves for the month |
| **Used This Month** | Leaves consumed during the month |
| **Manual Adj.** | Manual adjustment value (if any) |
| **Month-End Balance** | Closing balance for the month |

---

### 4.11 Concerns

![Concerns](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/admin_concerns_1773986673120.png)
*Concerns tab showing employee-raised issues with resolution status*

**Purpose:** Resolution center for employee-raised HR issues relating to attendance or payroll discrepancies.

#### Table Columns

| Column | Description |
|--------|-------------|
| **Employee** | Name of the employee who raised the concern |
| **Type** | Category: `Attendance`, `Payroll`, etc. |
| **Summary** | Brief description of the concern |
| **Status** | `Pending` / `Resolved` |
| **Actions** | `Reply` · `Reopen` |

> [!NOTE]
> Employees can raise concerns from multiple places: the Attendance tab, Leave Applications tab, WFH tab, and Salary Slip tab — all via the "Raise Concern" row-level action.

---

## 5. User Profile

![User Profile](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/hrms_full_page_start_1773986144739.png)
*User Profile page showing professional info, bank details, and salary structure (masked)*

**Access:** Click the user avatar (initials circle) in the top-right of the header.

**Purpose:** View and manage personal employee information including professional details, banking info, and salary structure.

### Sections

#### Profile Card (Left Panel)

| Element | Description |
|---------|-------------|
| **Avatar** | Circular icon with initials |
| **Full Name** | Employee's full name |
| **Department** | Employee's department |
| **Edit Profile Data** | Button to edit profile information |

#### Professional Information

| Field | Example |
|-------|---------|
| **Employee ID** | S-1078 |
| **Email Address** | ankush.das@hochhuth-consulting.de |
| **Designation** | Associate Software Developer |
| **Department** | SPFx |
| **Joining Date** | September 8, 2025 |

#### Bank & Payroll Details

| Field | Description |
|-------|-------------|
| **PAN Number** | Masked by default (●●●●●●●●) |
| **UAN Number** | Masked by default |
| **Bank Name** | Masked by default |
| **Account Number** | Masked by default |
| **IFSC Code** | Masked by default |

> **Show Salary Data** toggle (top-right of the section) reveals the masked values.

#### Salary Structure

| Field | Description |
|-------|-------------|
| **Yearly CTC** | Annual cost to company |
| **Salary Bonus** | Bonus component |
| **Salary Insurance** | Insurance deduction |

#### Action Buttons

| Button | Action |
|--------|--------|
| **Edit Profile Data** | Opens the profile edit form |
| **Back to Dashboard** | Returns to the main Employee/HR Dashboard |

---

## 6. Navigation Summary Table

### Employee View Navigation

| Tab | Sub-tabs / Views | Key Features |
|-----|-----------------|--------------|
| **Dashboard** | — | Leave balance, upcoming holidays, low working hours, team celebrations |
| **Attendance** | Daily, Weekly, Monthly · Table View, Calendar View | Clock-in/out records, Raise Concern per row |
| **Leave Applications** | — | History table, New Request modal (Leave Type, Dates, Half Day, Recurrence, Reason) |
| **Work From Home** | — | History table, New Request modal (WFH Type, Dates, Half Day, Recurrence, Reason) |
| **Salary Slip** | — | Payslip table, Download Slip, Raise Concern |

### HR Admin View Navigation

| Tab | Sub-tabs | Key Features |
|-----|---------|--------------|
| **Dashboard** | — | Org stats cards, charts by type/dept, Generate Weekly Report, Add Event |
| **Leaves Request** | — | Approve/Reject pending leaves, Date Range & Status filters |
| **WFH Request** | — | Approve/Reject WFH, department avatar grouping |
| **Global Directory** | — | All employees, Add User (4-tab form), Export to Excel |
| **Global Attendance** | Date, Weekly, Monthly | Import/Export attendance, Delete by date, Generate Report |
| **Upload Salary Slip** | — | Per-employee salary slip generation with full payroll breakdown |
| **On Leave / WFH Today** | — | Real-time absence list, Send Report, Add Manual Entry |
| **Leave Policy** | — | Policy CRUD (Edit/Delete), configurable HR policy text |
| **Official Leaves** | — | Holiday management, leave quota configuration |
| **Carry Forward Leaves** | — | Monthly accrual tracking, opening/closing balances, manual adjustments |
| **Concerns** | — | Employee concern tickets, Reply, Reopen |

### User Profile (accessible from header avatar)

| Section | Key Fields |
|---------|-----------|
| **Professional Info** | Employee ID, Email, Designation, Department, Joining Date |
| **Bank & Payroll** | PAN, UAN, Bank Name, Account No., IFSC (all masked by default) |
| **Salary Structure** | Yearly CTC, Bonus, Insurance |
| **Actions** | Edit Profile Data, Back to Dashboard |

---

## Recording

The following recording captures the live browser exploration of the application:

![HRMS Application Exploration Recording](/Users/anubhav/.gemini/antigravity/brain/b67260e6-1270-412e-a4e2-a19d2632611e/hrms_screenshots_capture_1773986406150.webp)
*Full exploration walkthrough of all Employee and HR Admin tabs*

---

*Documentation prepared: March 20, 2026 | Read-only exploration — no data was created or modified.*
