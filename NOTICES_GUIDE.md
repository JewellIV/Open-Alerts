# Time-Based Notices System Guide

## Overview

The notices system allows you to create notices that:
- **Expire** after a certain date/time
- **Appear only during specific times** of day (e.g., 8 AM - 5 PM)
- **Show only on specific days** of the week (e.g., Monday, Wednesday, Friday)
- **Display only on meeting nights** (e.g., every Tuesday)

## Accessing the Admin Page

1. **Open the dashboard** in your browser
2. **Click the "Admin" link** in the bottom-left corner, OR
3. **Navigate to:** `http://localhost:5173/#admin`

## Creating a Notice

### Basic Notice
- **Text:** The notice message
- **Priority:** Low, Medium, or High (affects color coding)

### Time-Based Rules

#### Expiration Date
- Set `Expires At` to automatically hide the notice after a specific date/time
- Example: Set to "2024-12-31 23:59" to expire at end of year

#### Time of Day
- **Start Time:** Notice appears only after this time (24-hour format: HH:MM)
- **End Time:** Notice disappears after this time
- Example: Start: "08:00", End: "17:00" → Shows only 8 AM - 5 PM

#### Days of Week
- Enter comma-separated numbers: `0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday`
- Example: `1,3,5` → Shows only Monday, Wednesday, Friday

#### Meeting Night Only
- Check "Meeting Night Only"
- Select the day of week (e.g., Tuesday)
- Notice will only appear on that day of the week

## Examples

### Example 1: Daily Reminder (8 AM - 5 PM)
```
Text: "All personnel check equipment daily"
Start Time: 08:00
End Time: 17:00
```

### Example 2: Meeting Night Notice (Tuesdays Only)
```
Text: "Department meeting tonight at 7 PM"
Meeting Night Only: ✓
Meeting Day: Tuesday
```

### Example 3: Temporary Notice (Expires in 1 Week)
```
Text: "Station maintenance scheduled for next Monday"
Expires At: 2024-01-15 23:59
```

### Example 4: Weekday Only Notice
```
Text: "Office hours: Monday-Friday, 9 AM - 5 PM"
Days of Week: 1,2,3,4,5
Start Time: 09:00
End Time: 17:00
```

### Example 5: Weekend Notice
```
Text: "Weekend duty roster posted"
Days of Week: 0,6
```

## API Endpoints

### Get Active Notices (Public)
```
GET /api/notices
```
Returns only notices that are currently active based on time rules.

### Get All Notices (Admin - Requires API Key)
```
GET /api/notices/all?api_key=YOUR_KEY
```

### Create Notice (Admin - Requires API Key)
```
POST /api/notices?api_key=YOUR_KEY
Content-Type: application/json

{
  "text": "Notice text",
  "priority": "medium",
  "expires_at": "2024-12-31T23:59:00",
  "start_time": "08:00",
  "end_time": "17:00",
  "days_of_week": "1,2,3,4,5",
  "is_meeting_night": false,
  "meeting_day_of_week": null
}
```

### Update Notice (Admin - Requires API Key)
```
PUT /api/notices/:id?api_key=YOUR_KEY
Content-Type: application/json

{
  "text": "Updated text",
  "is_active": 1
}
```

### Delete Notice (Admin - Requires API Key)
```
DELETE /api/notices/:id?api_key=YOUR_KEY
```

## Database Schema

The `notices` table includes:
- `id` - Primary key
- `text` - Notice message
- `priority` - low, medium, or high
- `created_at` - When notice was created
- `expires_at` - When notice expires (NULL = never expires)
- `start_time` - Start time of day (HH:MM format, NULL = all day)
- `end_time` - End time of day (HH:MM format, NULL = all day)
- `days_of_week` - Comma-separated day numbers (NULL = all days)
- `is_meeting_night` - Boolean (0 or 1)
- `meeting_day_of_week` - Day number (0-6, NULL if not meeting night)
- `is_active` - Boolean (0 = inactive, 1 = active)

## How It Works

1. **Notices are stored** in SQLite database
2. **Frontend fetches** active notices every minute
3. **Backend filters** notices based on:
   - Current date/time vs expiration
   - Current time vs start/end time
   - Current day vs allowed days
   - Current day vs meeting night day
4. **Only active notices** are displayed in the scrolling banner
5. **Real-time updates** via Socket.io when notices are added/updated/deleted

## Tips

- **Set expiration dates** for temporary notices to keep the list clean
- **Use meeting night** for notices that should only appear on specific days
- **Combine rules** - e.g., meeting night + time window for "Meeting starts at 7 PM" notice
- **Priority colors:**
  - High = Red
  - Medium = Yellow
  - Low = Blue

---

**Need Help?** Check the main README.md for API documentation.
