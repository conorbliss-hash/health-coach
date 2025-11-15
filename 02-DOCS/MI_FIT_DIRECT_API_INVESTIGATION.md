# Mi Fit Direct API Investigation: Viability Assessment

**Goal:** Determine if pulling sleep data directly from Mi Fit (bypassing Google Health) is straightforward.

**Date:** 15 November 2025

---

## Summary: Is It Straightforward?

**Short Answer:** ⚠️ **Not exactly straightforward, but feasible.**

There are 2 main approaches:

### Approach 1: Huami GDPR Export (Simple, But Manual)
- ✅ Easiest to implement (~50 lines of code)
- ❌ Requires manual export request once per extraction
- ❌ Data arrives via email (async)
- ✅ Most reliable (official data)

### Approach 2: Direct Bluetooth/API Access (Moderate, Fully Automated)
- ✅ Fully automated (no manual steps)
- ❌ Requires Bluetooth connection or reverse-engineered API
- ⚠️ More complex to set up

---

## Option 1: Huami GDPR Export (Recommended for Quick Fix)

### How It Works

Xiaomi/Huami has a [GDPR data export portal](https://user.huami.com/gdpr/v2/index.html) that allows you to download all your fitness data.

**Process:**
1. User logs into https://user.huami.com/gdpr/v2/index.html
2. Requests data export
3. System extracts all Mi Band data and sends a download link via email
4. Data is provided as ZIP with CSV files

**Data Structure Included:**
```
├─ SLEEP/
│  └─ SLEEP_*.csv          ← What you need
├─ ACTIVITY/
├─ HEARTRATE/
└─ ... (other data types)
```

### Pros
- ✅ **Official Huami API** (no reverse engineering)
- ✅ **Complete & accurate data** (straight from source)
- ✅ **Less than 100 lines of Python** to implement
- ✅ **Reliable** (won't break with app updates)

### Cons
- ❌ **Async process** (export takes 1-2 hours)
- ❌ **Manual trigger** (user must request data)
- ❌ **Rate limited** (can't request more than once per day typically)

### Implementation Effort
**Low (~2-3 hours)**
- Requires: Requests library, cookie handling, email parsing
- Similar complexity to what you already have with Google Fit API

### Code Skeleton
```python
def export_from_huami():
    """
    1. Log in to Huami GDPR portal
    2. Request data export (returns UUID)
    3. Poll for completion
    4. Download zip file
    5. Extract SLEEP_*.csv
    6. Parse and sync to sheets
    """
    pass
```

---

## Option 2: Direct Mi Fit Cloud API (Moderate Complexity)

### How It Works

Several open-source projects have reverse-engineered the Mi Fit API:

**Relevant Projects:**
1. **[xiaomi-mi-fit-data-export](https://github.com/zoilomora/xiaomi-mi-fit-data-export)**
   - Uses Huami GDPR export (see Option 1)
   - Python, but manual-triggered

2. **[miband-HR-python](https://github.com/danielsousaoliveira/miband-HR-python)**
   - Bluetooth direct connection
   - Requires local Bluetooth access to device
   - Real-time data (heart rate)
   - Complex setup (Linux + gatt library)

### How Direct API Would Work
1. Authenticate with Huami Cloud using Mi Fit credentials
2. Query `/users/me/sleep` endpoint or similar
3. Parse response and sync to sheets

### Challenges
- ⚠️ **Reverse-engineered API** (not official)
- ⚠️ **Likely to break** when Xiaomi updates their servers
- ⚠️ **Terms of service violation** risk
- ❌ **Authentication complex** (requires device tokens/certificates)

### Implementation Effort
**Moderate-High (~10-20 hours)**
- Need to handle authentication tokens
- May require mocking device headers/certificates
- Likely needs reverse-engineering via network inspection

---

## Option 3: Gadgetbridge (Offline-First Alternative)

**[Gadgetbridge](https://codeberg.org/Freeyourgadget/Gadgetbridge)** is an open-source replacement for vendor apps:

- Connects directly via Bluetooth to Mi Band
- Syncs to local database
- No cloud required
- Can export data as CSV/JSON

### Pros
- ✅ Privacy-first (no cloud)
- ✅ Reliable (open source, well-maintained)
- ✅ Supports all Mi Band models

### Cons
- ❌ Requires USB Android device or Linux computer with Bluetooth
- ❌ Complex setup for headless use (cron job)
- ❌ 20-30 hours to integrate properly

---

## My Recommendation

### For Your Use Case (Quick Fix)

**Go with Option 1 (Huami GDPR Export)** because:

1. **Simple to implement** (~100 lines of code)
2. **Official & reliable** (Huami-provided, won't break)
3. **Works from anywhere** (no hardware requirements)
4. **Can be triggered daily** via cron + email parser

### Implementation Steps

1. **User initiates export once** via https://user.huami.com/gdpr/v2/index.html
   - Or automate with selenium (complex but possible)

2. **Cron job checks email** for Huami export link daily
   ```python
   def check_email_for_huami_export():
       # IMAP into your email
       # Look for email from Huami with subject "Your data is ready"
       # Extract download URL
       # Download ZIP
       # Extract SLEEP_*.csv
       # Parse & sync to sheets
   ```

3. **Parse sleep CSV** and sync to Google Sheets (similar to current fit_to_sheets.py)

### Estimated Effort
- **Development:** 3-5 hours
- **Testing:** 1-2 hours
- **Deployment:** 30 minutes

---

## Proof of Concept: What Data You'd Get

From Huami GDPR export, `SLEEP_*.csv` looks like:

```
date,start_time,end_time,sleep_duration,deep_sleep_duration,light_sleep_duration,rem_sleep_duration,awake_duration,sleep_quality_index
2025-11-14,23:30:00,08:15:00,530,120,310,100,0,85
2025-11-13,22:45:00,07:30:00,465,90,280,95,0,82
```

**Key advantage:** Raw sleep data WITHOUT the Google Health "spurious wake-up" errors.

---

## Quick Decision Matrix

| Approach | Effort | Reliability | Automation | Recommendation |
|----------|--------|-------------|-----------|-----------------|
| **Huami GDPR** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ | ✅ **START HERE** |
| **Huami GDPR + Automation** | ⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ✅ **NEXT PHASE** |
| **Direct MI Fit API** | ⭐⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐⭐ | ❌ High risk |
| **Gadgetbridge** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ | ❌ Too complex |

---

## Next Steps

### If you want to proceed:

1. **Phase 1 (Immediate):**
   - Test Huami GDPR export manually once
   - Document the CSV structure you receive
   - Verify sleep data is accurate

2. **Phase 2 (Implementation):**
   - Build CSV parser
   - Integrate with fit_to_sheets.py
   - Test with dry-run

3. **Phase 3 (Automation - Optional):**
   - Add Selenium-based automation for export requests
   - Set up email polling
   - Make it fully hands-off

### Questions for You

1. **Would a semi-manual approach work?** (i.e., you manually export from Huami once/week, then script handles the sync)
2. **Do you have access to your Mi Fit/Huami credentials?**
3. **What's your tolerance for semi-automatic vs fully automatic?**

---

## Conclusion

**Straightforward enough?** 

Yes, but with caveats:

- **Option 1 (Huami Export):** 3-5 hours, reliable, semi-automatic ✅
- **Option 2 (Direct API):** 10-20 hours, risky, fully automatic ❌
- **Option 3 (Gadgetbridge):** 20+ hours, complex, offline-first ❌

**My vote:** Start with Option 1 (Huami GDPR Export) as a proof-of-concept. Once you verify the data quality is better than Google Health, you can decide if automation is worth the extra investment.

---

**Questions or want to start implementing?** Let me know and I can help with Phase 1!
