# 3D Printable Case for Raspberry Pi 5 + MAGEX Touchscreen Monitor

This design provides a combined 3D printable case that houses both a Raspberry Pi 5 and a MAGEX touchscreen monitor in a single enclosure.

## Design Overview

The case features:
- **Separate compartments** for Raspberry Pi 5 and touchscreen monitor
- **Wall mountable** - includes 4 mounting holes for easy wall installation
- **Ventilation holes** for proper cooling of the Raspberry Pi
- **Cable management** openings for HDMI, USB, and power cables
- **Parametric design** - easily customizable via OpenSCAD variables
- **3D printable** - designed with printability in mind (minimal supports needed)

## Components

### Raspberry Pi 5 Compartment
- Dimensions: 98.5mm × 70.3mm × 33mm (with clearance)
- Located at the front/bottom of the case
- Includes ventilation holes on sides and base
- Cable opening for USB, HDMI, and power connections

### Touchscreen Monitor Compartment
- Designed for 15.6" MAGEX touchscreen (360mm × 220mm)
- Located at the back/top of the case
- Screen opening for display visibility
- Accommodates screen thickness up to 20mm

### Wall Mounting
- **4 mounting holes** in rectangular pattern (200mm × 150mm spacing)
- **5mm diameter holes** suitable for M4 or M5 screws
- **Countersunk design** for flush mounting with flat-head screws
- **Standard wall mount spacing** - compatible with most wall mount brackets

## Files

- `raspberry-pi-touchscreen-case.scad` - OpenSCAD parametric design file
- `raspberry-pi-touchscreen-case.stl` - Pre-exported STL file (or use export script)
- `export-to-stl.ps1` - PowerShell script to export SCAD to STL
- `README.md` - This file

## Exporting to STL

### Method 1: Using the Export Script (Windows)

1. Install OpenSCAD from https://openscad.org/downloads.html
2. Open PowerShell in this directory
3. Run: `.\export-to-stl.ps1`
4. The STL file will be created automatically

### Method 2: Manual Export (All Platforms)

1. Install OpenSCAD from https://openscad.org/downloads.html
2. Open `raspberry-pi-touchscreen-case.scad` in OpenSCAD
3. Press **F6** to render the model (or go to Design > Render)
4. Once rendered, go to **File > Export > Export as STL**
5. Save as `raspberry-pi-touchscreen-case.stl`

### Method 3: Command Line Export

```bash
openscad -o raspberry-pi-touchscreen-case.stl raspberry-pi-touchscreen-case.scad
```

## Customization

The design is fully parametric. Open `raspberry-pi-touchscreen-case.scad` in OpenSCAD and adjust these variables at the top:

```scad
// Raspberry Pi 5 Case Dimensions
pi5_length = 98.5;  // mm
pi5_width = 70.3;   // mm
pi5_height = 33;    // mm

// MAGEX Touchscreen Dimensions
screen_width = 360;   // mm (adjust for your screen size)
screen_height = 220;  // mm
screen_thickness = 20; // mm

// Case Design Parameters
wall_thickness = 3;      // mm
base_height = 5;         // mm
clearance = 2;           // mm
```

### For Different Screen Sizes

If you have a different MAGEX touchscreen model (e.g., 10.1"), adjust these values:

**10.1" Model:**
```scad
screen_width = 260;   // mm (approximate)
screen_height = 165;  // mm
screen_thickness = 15; // mm
```

**13.3" Model:**
```scad
screen_width = 310;   // mm
screen_height = 195;  // mm
screen_thickness = 18; // mm
```

## 3D Printing Instructions

### Printer Settings

- **Layer Height**: 0.2mm (recommended) or 0.3mm (faster)
- **Infill**: 20-30%
- **Supports**: Not required (design is self-supporting)
- **Print Orientation**: Print with base plate flat on build plate
- **Material**: PLA or PETG recommended
- **Estimated Print Time**: 8-12 hours (depending on printer and settings)

### Print Settings by Material

**PLA:**
- Nozzle: 0.4mm
- Temperature: 200-220°C
- Bed: 60°C
- Cooling: 100%

**PETG:**
- Nozzle: 0.4mm
- Temperature: 230-250°C
- Bed: 80-90°C
- Cooling: 50-70%

**ABS:**
- Nozzle: 0.4mm
- Temperature: 240-260°C
- Bed: 90-100°C
- Enclosure recommended
- Cooling: 0-20%

### Post-Processing

1. **Remove supports** (if any were added)
2. **Clean up** any stringing or blobs
3. **Test fit** components before final assembly
4. **Sand** if needed for smoother finish (optional)

### STL File Notes

The exported STL file may show a "non-manifold" warning. This is common with complex geometries and most slicers (Cura, PrusaSlicer, etc.) can automatically repair this during import. If your slicer doesn't auto-repair:

- **Cura**: Automatically fixes non-manifold issues
- **PrusaSlicer**: Automatically fixes non-manifold issues  
- **Other slicers**: Use MeshMixer or Netfabb to repair if needed

## Wall Mounting Instructions

### Mounting Hole Specifications
- **Hole Pattern**: 200mm × 150mm rectangular pattern (centered on case)
- **Hole Diameter**: 5mm (suitable for M4 or M5 screws)
- **Screw Recommendations**: 
  - M4 screws (4mm) with washers for drywall anchors
  - M5 screws (5mm) for direct mounting to studs
  - Length: 20-30mm depending on wall type

### Installation Steps

1. **Mark mounting points** on the wall:
   - Use a level to ensure straight mounting
   - Mark the 4 hole positions (200mm × 150mm pattern)
   - For drywall: Use wall anchors or toggle bolts
   - For studs: Locate studs and mount directly

2. **Drill pilot holes**:
   - Drill holes slightly smaller than your screws
   - Depth: 20-30mm depending on wall type

3. **Mount the case**:
   - Align mounting holes with wall holes
   - Insert screws through case into wall
   - Tighten securely but don't overtighten (may crack plastic)

4. **Alternative: Use mounting bracket**:
   - Attach a VESA-compatible bracket to the wall
   - Use adapter plate if needed to match hole pattern
   - Mount case to bracket

## Assembly Instructions

1. **Print the case** using the settings above
2. **Mount to wall** (see Wall Mounting Instructions above) or place on flat surface
3. **Place Raspberry Pi 5** (with or without official case) into the Pi5 compartment
4. **Route cables** through the cable openings:
   - HDMI cable from Pi5 to touchscreen
   - USB-C power cable for Pi5
   - USB cable for touchscreen (if needed)
   - Power cable for touchscreen
   - Any other required connections
5. **Place touchscreen** into the screen compartment with display facing forward
6. **Secure components** (optional):
   - Use double-sided tape for screen
   - Use Velcro strips for Pi5
   - Use cable ties to manage cables

## Customizing Mounting Holes

The mounting holes are already included in the design. To customize them, adjust these variables in the SCAD file:

```scad
// Wall Mount Parameters
mount_hole_diameter = 5;      // mm - mounting screw hole diameter
mount_hole_spacing_x = 200;   // mm - horizontal spacing between mount holes
mount_hole_spacing_y = 150;   // mm - vertical spacing between mount holes
mount_hole_offset = 20;       // mm - offset from edges for mounting holes
mount_hole_depth = 10;        // mm - depth of countersunk area
```

**Common Mount Patterns:**
- **VESA 100**: Set spacing to 100mm × 100mm
- **VESA 75**: Set spacing to 75mm × 75mm
- **Custom**: Adjust spacing to match your wall bracket

### Adding a Lid

To create a lid/cover, duplicate the base_plate module and modify it to create a top cover with appropriate clearances.

### Adjusting Ventilation

Modify `vent_hole_size` and `vent_spacing` variables to increase or decrease ventilation:
- Larger holes = more airflow but weaker walls
- Smaller spacing = more holes but more print time

## Troubleshooting

### Components Don't Fit

- **Increase clearance**: Change `clearance = 2;` to `clearance = 3;` or higher
- **Check dimensions**: Verify your actual component dimensions match the variables

### Print Fails or Warps

- **Use brim**: Add a 5-10mm brim for better bed adhesion
- **Check bed leveling**: Ensure first layer is properly squished
- **Reduce speed**: Print first layer at 20-30mm/s
- **Use enclosure**: For ABS or in drafty environments

### Ventilation Insufficient

- **Increase vent_hole_size**: Change from 5mm to 6-8mm
- **Add more holes**: Reduce vent_spacing from 15mm to 10mm
- **Add top vents**: Modify the design to include top ventilation

## License

This design is provided as-is for personal and commercial use. Modify as needed for your specific requirements.

## Support

For issues or questions:
1. Check that your component dimensions match the variables
2. Verify your printer settings
3. Adjust parameters as needed for your specific components

## Notes

- The design assumes the Raspberry Pi 5 is in its official case (or similar dimensions)
- Screen dimensions are approximate - measure your actual screen and adjust accordingly
- Cable routing may need adjustment based on your specific cable types and lengths
- Consider adding a small fan mount if additional cooling is needed
