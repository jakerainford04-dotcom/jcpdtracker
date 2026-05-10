# Job Credits Tracker — App Specification

## Overview
A mobile-first PWA for gas engineers to track weekly job credits against a bonus target. Engineers log jobs throughout the day, the app calculates credits, and shows whether earned credits exceed the adjusted weekly target (bonus).

## How the Bonus Scheme Works
1. Each engineer has a **base weekly hours** target (default: 40 hours, adjustable per user)
2. **Deductions** are subtracted from base hours (travel, absences, waiting for work etc.) — entered as a single total in hours/minutes
3. This gives an **adjusted weekly target** in hours
4. Every job completed earns **credit minutes** (each job type has a fixed minute value)
5. Credits convert to hours: `credit_hours = total_credit_minutes / 60`
6. If `total_credit_hours > adjusted_target_hours` → **bonus achieved**
7. Travel deductions arrive ~10 days after the week, so **previous weeks must be editable**

## Credit Conversion
- Formula: `job_credits = minutes / 83.58`
- Basis: 56 minutes = 0.67 job credits
- For the weekly bonus calculation, total credit minutes are converted to hours and compared against the adjusted target hours

---

## Job Types Data

### Core Jobs (19 types)

| ID | Name | Minutes | Credits | Variable |
|----|------|---------|---------|----------|
| ib_ff | IB, FF (All Appliance Types) | 56 | 0.67 | No |
| linked_ib | Linked IB (Job on same appliance as ASV) | 56 | 0.67 | No |
| asv_chb_cir_wh_swh | ASV (CHB, CIR, WH, SWH) | 40 | 0.48 | No |
| asv_fre | ASV (FRE) | 47 | 0.56 | No |
| asv_hob_ckr_ovn | ASV (HOB, CKR, OVN) | 23 | 0.28 | No |
| asv_mwh_wal | ASV (MWH, WAL) | 35 | 0.42 | No |
| asv_bbf_wau_waw_aga | ASV (BBF, WAU, WAW, AGA) | 63 | 0.75 | No |
| as_inst | AS - INST (Landlords Inspection) | 21 | 0.25 | No |
| fv_chb | FV (CHB) | 48 | 0.57 | No |
| fv_bbf_wau_waw | FV (BBF, WAU, WAW) | 71 | 0.85 | No |
| ld_completed | LD (Completed) | 205 | 2.45 | No |
| upgrade_work | Upgrade Work (per hour quoted) | 60 | 0.72 | Yes — prompt for hours quoted, multiply |
| standalone_quote | Standalone Quote Job | 31 | 0.37 | No |
| free_gas_safety | Free Gas Safety Check | 30 | 0.36 | No |
| oca | OCA (All Appliance Types) | 56 | 0.67 | No |
| remedial_safety | Remedial Safety (Only on FV's) | 30 | 0.36 | No |
| trace_repair | Trace & Repair | per min | 0.01/min | Yes — prompt for minutes on completion |
| install_cod | Install COD | 5 | 0.06 | No |
| hive_install_generic | Hive Install | 90 | 1.08 | No |

### Hive Jobs (15 types)

| Code | Name | Minutes | Credits | Variable |
|------|------|---------|---------|----------|
| HVI-HUB | Hive Install - OpenTherm Upgrade | 40 | 0.48 | No |
| HVI-IIO | Hive Inday Install Offer | 34 | 0.41 | No (Hive portion only; Gas Repair 56 mins logged separately) |
| HVI-MIN | Hive Install - Mini Thermostat | 90 | 1.08 | No |
| HVI-IMZ | Hive Install - Multizone | 30 | 0.36 | No (one per additional zone) |
| HVI-TRV | Hive Install - TRV | 30 | 0.36 | No (one job per two TRVs) |
| HVI-WLS | Hive Install - Wireless Thermostat | 90 | 1.08 | No |
| HVI-WRD | Hive Install - Wired Thermostat | 60 | 0.72 | No |
| HVR-THE | Hive Repair - Thermostat | 56 | 0.67 | No |
| HVR-TRV | Hive Repair - TRV | 56 | 0.67 | No |
| HVU-THE | Hive Uninstall - Thermostat | 90 | 1.08 | No |
| INSHV-MIN | Install Hive Mini Thermostat (Solvers) | 90 | 1.08 | No |
| INSHV-THR | Install Hive Thermostat (Solvers) | 90 | 1.08 | No |
| INSHV-TRV | Install Hive TRVs (Solvers) | — | — | Yes — linked to charge time, prompt for minutes |
| RCHV-THR | Recall Hive Thermostat | 56 | 0.67 | No |
| RCHV-TRV | Recall Hive TRVs | 56 | 0.67 | No |

### Sales Credits (1 type for now — more to be added later)

| Name | Fulfilment Credit (Mins) | Credits | SGO Payment |
|------|--------------------------|---------|-------------|
| HI Lead (Boiler Lead) | 58 | 0.69 | None |

---

## App Features

### Core Features
- **Job logging**: Tap a job type to log it. Fixed-credit jobs log instantly. Variable jobs (Trace & Repair, Upgrade Work, INSHV-TRV) prompt for time input.
- **Daily view**: See jobs logged today with running daily total
- **Weekly dashboard**: Total earned credit hours vs adjusted target hours. Clear visual indicator (green/red) for bonus status.
- **Deductions**: Enter total non-productive time in hours/minutes. Single bucket — no subcategories needed.
- **Settings**: Adjustable base weekly hours (default 40, changes quarterly)

### History & Editing
- View previous weeks and their results
- Edit previous weeks to add late-arriving deductions (especially travel ~10 days later)
- Daily breakdown within each week

### Platform
- Mobile-first PWA — installable on phone
- Also accessible via browser on desktop
- Local storage for all data (no backend needed for v1)

---

## UI Suggestions
- Job types grouped by category (Core / Hive / Sales) with tabs or collapsible sections
- Most common jobs should be easily accessible (consider "favourites" or "recent" section)
- Weekly progress bar or gauge showing credits earned vs target
- Colour coding: green when above target, amber when close, red when below
- Simple number entry for variable jobs (Trace & Repair minutes, Upgrade Work hours)
- Week selector to navigate between weeks and edit previous ones
