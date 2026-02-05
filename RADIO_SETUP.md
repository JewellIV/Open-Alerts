# Radio Integration Setup Guide

Guide for integrating radio audio streams with automatic nighttime muting.

## Overview

The radio system automatically:
- **Plays continuously during daytime** (06:30 - 20:30)
- **Mutes during nighttime** (20:30 - 06:30) to avoid disturbing sleepers
- **Mutes before alerts** during nighttime, then **unmutes after alert sounds complete**
- **Resumes normal operation** after alerts (muted if nighttime, unmuted if daytime)

## Configuration

### Step 1: Get Radio Stream URL

You need a radio stream URL. Common formats:
- **MP3 Stream:** `http://radio.example.com:8000/stream.mp3`
- **M3U Playlist:** `http://radio.example.com/playlist.m3u` (may need to extract actual stream URL)
- **Shoutcast/Icecast:** `http://radio.example.com:8000/stream`

**Free Radio Stream Sources:**
- Radio stations often provide stream URLs on their websites
- Look for "Listen Live" or "Stream" links
- Right-click → Copy link address
- Common formats: `.mp3`, `.m3u`, `.pls`

### Step 2: Configure Radio URL

**Method 1: Environment Variable (Recommended)**

Create or edit `frontend/.env`:
```env
VITE_RADIO_URL=http://radio.example.com:8000/stream.mp3
```

**Method 2: Browser localStorage**

Open browser console (F12) and run:
```javascript
localStorage.setItem('radioUrl', 'http://radio.example.com:8000/stream.mp3')
location.reload()
```

### Step 3: Restart Application

After setting the radio URL:
1. Rebuild frontend: `cd frontend && npm run build`
2. Restart the application
3. Radio will start automatically

## How It Works

### Daytime Behavior (06:30 - 20:30)

- Radio plays at **100% volume**
- Radio continues playing during alerts
- No muting occurs

### Nighttime Behavior (20:30 - 06:30)

- Radio starts **muted** (0% volume)
- When alert arrives:
  1. Radio mutes (if not already muted)
  2. Alert beeps play
  3. TTS announcement plays
  4. Radio unmutes after alert sounds complete
  5. Radio continues playing (muted) until next alert or daytime

### Alert Sequence (Nighttime)

```
1. Alert arrives → Radio mutes
2. Alert beeps play
3. TTS announcement plays
4. Radio unmutes (2 seconds after announcement)
5. Radio continues muted (still nighttime)
```

## Testing

### Test Radio Playback

1. **Set radio URL** in `.env` or localStorage
2. **Restart application**
3. **Check browser console** for:
   - `📻 Radio started playing` (daytime)
   - `🌙 Nighttime - starting radio muted` (nighttime)

### Test Nighttime Muting

1. **Set system time to nighttime** (20:30 - 06:30)
2. **Restart application**
3. **Verify radio is muted** (no sound)
4. **Send test alert**
5. **Verify:**
   - Radio mutes before alert sounds
   - Alert sounds play clearly
   - Radio unmutes after alert completes
   - Radio remains muted (still nighttime)

### Test Daytime Playback

1. **Set system time to daytime** (06:30 - 20:30)
2. **Restart application**
3. **Verify radio plays at full volume**
4. **Send test alert**
5. **Verify:**
   - Radio continues playing during alert
   - Alert sounds play over radio
   - Radio continues after alert

## Troubleshooting

### Radio Not Playing

1. **Check radio URL:**
   ```javascript
   // In browser console
   console.log(localStorage.getItem('radioUrl'))
   ```

2. **Test URL directly:**
   - Open radio URL in browser
   - Should start playing audio
   - If not, URL may be incorrect

3. **Check browser console:**
   - Look for radio errors
   - Check for CORS issues
   - Verify audio autoplay permissions

4. **Check network:**
   - Ensure radio stream is accessible
   - Some streams may require specific headers
   - Try different radio stream URL

### Radio Not Muting at Night

1. **Check system time:**
   - Verify computer time is correct
   - Check timezone settings

2. **Check console logs:**
   - Should see: `🌙 Nighttime - starting radio muted`
   - Should see: `🔇 Radio muted`

3. **Verify radio is enabled:**
   - Check: `📻 Radio started`
   - Radio must be initialized and playing

### Radio Unmutes Immediately After Alert

1. **Check timing:**
   - Radio unmutes 2 seconds after TTS completes
   - This is intentional to allow alert sounds to finish

2. **If radio unmutes too quickly:**
   - Increase delay in `radioManager.ts`
   - Modify `unmuteRadioAfterAlert` function

### Radio Plays During Day But Should Be Muted

1. **Check time detection:**
   ```javascript
   // In browser console
   const now = new Date()
   const hours = now.getHours()
   const minutes = now.getMinutes()
   console.log(`Current time: ${hours}:${minutes}`)
   ```

2. **Verify nighttime range:**
   - Nighttime: 20:30 (8:30 PM) to 06:30 (6:30 AM)
   - Daytime: 06:30 (6:30 AM) to 20:30 (8:30 PM)

## Advanced Configuration

### Custom Radio Volume

Modify `frontend/src/utils/radioManager.ts`:
```typescript
// Change default volume
radioAudio.volume = 0.8 // 80% volume instead of 100%
```

### Custom Unmute Delay

Modify delay after alerts:
```typescript
// In radioManager.ts, unmuteRadioAfterAlert function
setTimeout(() => {
  // ... unmute logic
}, 3000) // 3 seconds instead of 2
```

### Multiple Radio Streams

Currently supports one radio stream. For multiple streams:
1. Create multiple audio elements
2. Modify `radioManager.ts` to handle multiple streams
3. Or use a radio aggregator service

## Radio Stream URL Examples

### Example Streams (for testing)

**Note:** These are examples - use your actual radio station stream URL

```env
# Local radio station
VITE_RADIO_URL=http://stream.example.com:8000/live

# Internet radio
VITE_RADIO_URL=http://icecast.example.com:8000/stream.mp3

# Shoutcast stream
VITE_RADIO_URL=http://radio.example.com:8000/;stream.mp3
```

### Finding Radio Stream URLs

1. **Visit radio station website**
2. **Look for "Listen Live" button**
3. **Right-click → Inspect Element**
4. **Find audio source URL**
5. **Copy URL and use in configuration**

### Common Radio Formats

- **MP3:** `http://server:port/stream.mp3`
- **AAC:** `http://server:port/stream.aac`
- **OGG:** `http://server:port/stream.ogg`
- **M3U Playlist:** Extract actual stream URL from playlist file

## Integration with Existing Features

The radio system integrates seamlessly with:

- ✅ **Alert System** - Mutes/unmutes automatically
- ✅ **Night Mode** - Respects nighttime hours
- ✅ **Display Configuration** - Works with all display types
- ✅ **Audio Alerts** - Alert sounds play over/with radio
- ✅ **TTS Announcements** - Radio mutes during announcements

## Security Notes

- Radio streams are loaded from external URLs
- Ensure radio stream URLs are from trusted sources
- Some streams may require CORS headers
- Browser may block autoplay - user interaction may be required initially

## Support

For radio integration issues:
1. Check browser console for errors
2. Verify radio URL is accessible
3. Test URL in browser directly
4. Check network connectivity
5. Verify time settings for nighttime detection
