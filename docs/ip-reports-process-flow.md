# Process Flow: How to Extract IP Reports

## Quick Flow (staff one-page)
1. Go to **Reports** from sidebar.
2. Open **IP Command Dashboard** for binder packets, or use report cards for individual outputs.
3. Set filters:
   - Date range
   - Unit
   - Optional resident
4. Click **Generate** for single report, or **Assemble Packet** for packet presets.
5. Export:
   - **Print/PDF** from report preview or packet builder
   - **Export CSV** from report export actions

---

## Detailed Flow

### Report Name: Infection Surveillance Trend
- Purpose (1 sentence)
  - Show infection counts/rates by period for surveillance trending.
- Where the data is entered:
  - Page/Route: IP Tracker (`IP` view)
  - Buttons/Actions: Add/Edit IP Case
  - Required fields: onset/specimen/event date, unit, category, status
- How to extract the report:
  1) Navigate to: Reports > Antibiotic & Infection Surveillance
  2) Set filters: date field + date range + unit + optional resident
  3) Validate: check missing dates and uncategorized cases
  4) Click Export CSV or Print Packet
- Output produced:
  - CSV columns: date, category, unit, counts, rate
  - Print layout sections: summary, trend chart, detailed rows
- If report looks wrong troubleshooting:
  - Missing denominator (resident-days/device-days)
  - Missing case closure dates
  - Unit name normalization mismatch

### Report Name: Device-Associated Infection Tracking
- Purpose (1 sentence)
  - Track CAUTI/CLABSI/device-associated events for quality and compliance.
- Where the data is entered:
  - Page/Route: IP Tracker (`IP` view)
  - Buttons/Actions: Add/Edit IP Case with HAI/device fields
  - Required fields: HAI type, device-associated flag, event/specimen date, unit
- How to extract the report:
  1) Navigate to: Reports > Antibiotic & Infection Surveillance
  2) Set filters: date range + unit + optional resident
  3) Validate: ensure HAI/device fields are populated
  4) Click Export CSV or Print Packet
- Output produced:
  - CSV columns: resident, unit, HAI type, device type, event date, lab status
  - Print layout sections: by unit, by event type, detail table
- If report looks wrong troubleshooting:
  - Missing device-days denominator
  - Incomplete HAI type assignment

### Report Name: Outbreak Line Listing
- Purpose (1 sentence)
  - Provide active/historical outbreak case line listing for survey and response.
- Where the data is entered:
  - Page/Route: Outbreak view
  - Buttons/Actions: Add outbreak case, contact tracing entries
  - Required fields: outbreak, resident/case details, onset date, unit/room
- How to extract the report:
  1) Navigate to: Reports > Outbreak section (or packet preset Outbreak)
  2) Set filters: date range + unit + optional resident
  3) Validate: case status and outbreak linkage completeness
  4) Click Export CSV or Print Packet
- Output produced:
  - CSV columns: outbreak, case, onset, status, location
  - Print layout sections: outbreak summary, case line list, contacts
- If report looks wrong troubleshooting:
  - Missing outbreak linkage on cases
  - Missing closure/resolution dates

### Report Name: Antibiotic Stewardship Summary
- Purpose (1 sentence)
  - Summarize active use, indications, and timeout/compliance status.
- Where the data is entered:
  - Page/Route: ABT view
  - Buttons/Actions: Add/Edit ABT case, stewardship review note
  - Required fields: medication, indication, start date, prescriber, review status
- How to extract the report:
  1) Navigate to: Reports > Stewardship outputs
  2) Set filters: date range + unit + optional resident
  3) Validate: missing indication/stop-date flags
  4) Click Export CSV or Print Packet
- Output produced:
  - CSV columns: resident, medication, indication, start/stop, timeout status
  - Print layout sections: active list, compliance summary, exception list
- If report looks wrong troubleshooting:
  - Missing indication fields
  - Missing timeout documentation

### Report Name: Vaccination Program Summary (Resident + Staff)
- Purpose (1 sentence)
  - Show coverage, due/declined, and campaign progress.
- Where the data is entered:
  - Page/Route: VAX view and Staff Vaccination Tracker
  - Buttons/Actions: Record due/given/declined, re-offer updates
  - Required fields: status, offer/education date, vaccine/date given
- How to extract the report:
  1) Navigate to: Reports > Immunization outputs
  2) Set filters: date range + unit + optional resident
  3) Validate: due-date and decline reason completeness
  4) Click Export CSV or Print Packet
- Output produced:
  - CSV columns: resident/staff, vaccine, status, dates, decline/re-offer
  - Print layout sections: coverage summary, due list, decline/re-offer tables
- If report looks wrong troubleshooting:
  - Missing season assignment
  - Missing unit mapping for staff records
