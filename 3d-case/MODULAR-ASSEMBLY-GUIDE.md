# Modular Case Assembly Guide

## Print Requirements

**For a 250mm × 250mm × 260mm build volume, you need:**

### **4 Parts Total**

The case dimensions are **368mm × 303.3mm × 43mm**, which requires splitting into 4 sections:

- **Part 1** (Bottom-Left): ~184mm × ~152mm × 43mm
- **Part 2** (Bottom-Right): ~184mm × ~152mm × 43mm  
- **Part 3** (Top-Left): ~184mm × ~152mm × 43mm
- **Part 4** (Top-Right): ~184mm × ~152mm × 43mm

Each part fits comfortably within your 250mm × 250mm build volume.

## Printing Instructions

### Print Settings

- **Layer Height**: 0.2mm (recommended) or 0.3mm (faster)
- **Infill**: 20-30%
- **Supports**: Not required
- **Print Orientation**: All parts print flat on build plate (base down)
- **Material**: PLA or PETG recommended
- **Estimated Print Time**: 2-3 hours per part (8-12 hours total)

### Print Order

Print all 4 parts. You can print them in any order, but recommended sequence:
1. Part 1 (Bottom-Left) - Contains most of Pi5 compartment
2. Part 2 (Bottom-Right) - Contains Pi5 compartment completion
3. Part 3 (Top-Left) - Contains screen compartment start
4. Part 4 (Top-Right) - Contains screen compartment completion

## Assembly Instructions

### Step 1: Prepare Parts

1. Remove any support material (shouldn't be needed)
2. Clean up any stringing or blobs
3. Test fit the connector pins and holes - they should fit snugly but not require force

### Step 2: Dry Fit Assembly

1. **Connect Part 1 and Part 2** (left-right):
   - Align the connector pins on Part 1's right edge with the connector holes on Part 2's left edge
   - Parts should snap together with a slight press fit

2. **Connect Part 3 and Part 4** (left-right):
   - Same process as above

3. **Connect Bottom Row (Parts 1+2) to Top Row (Parts 3+4)**:
   - Align connector pins on bottom row with holes on top row
   - Parts should align properly

### Step 3: Permanent Assembly

You have two options:

#### Option A: Friction Fit (No Glue)
- The connector pins are designed for a press fit
- If parts fit snugly, you may not need glue
- Test the assembly first before adding components

#### Option B: Glue Assembly (Recommended)
1. **Use CA glue (super glue)** or **PLA/PETG compatible epoxy**
2. Apply a small amount to connector pins before inserting
3. Assemble in this order:
   - First: Connect Part 1 ↔ Part 2 (bottom row)
   - Second: Connect Part 3 ↔ Part 4 (top row)
   - Third: Connect bottom row ↔ top row
4. Clamp or hold parts together for 5-10 minutes while glue sets
5. Let cure for 24 hours before mounting

### Step 4: Post-Assembly

1. **Check alignment**: Ensure all walls align properly
2. **Test component fit**: Place Raspberry Pi 5 and screen to verify fit
3. **Smooth seams** (optional): Sand any visible seams if desired
4. **Mount to wall**: Use the 4 mounting holes (200mm × 150mm pattern)

## Connector System

The parts use a pin-and-hole connector system:
- **Connector pins**: 4mm diameter, 10mm length
- **Connector holes**: 4.2mm diameter (0.2mm clearance)
- **Location**: Along split edges at 30mm intervals

### Connector Layout

- **Right edge of Part 1 & 3**: Has connector pins
- **Left edge of Part 2 & 4**: Has connector holes
- **Top edge of Part 1 & 2**: Has connector pins  
- **Bottom edge of Part 3 & 4**: Has connector holes

## Troubleshooting

### Parts Don't Fit Together

- **Check orientation**: Make sure you're connecting the correct edges
- **File connectors**: If too tight, lightly sand connector pins
- **Expand holes**: If too loose, you may need to re-print with adjusted clearance

### Gaps Between Parts

- **Check print quality**: Ensure parts printed accurately
- **Use filler**: Small gaps can be filled with CA glue + baking soda or epoxy putty
- **Re-print**: If gaps are significant, check printer calibration

### Parts Warped

- **Use brim**: Add 5-10mm brim for better bed adhesion
- **Check bed leveling**: Ensure first layer is properly squished
- **Reduce speed**: Print first layer at 20-30mm/s
- **Use enclosure**: For ABS or in drafty environments

## Alternative: Single-Piece Print

If you have access to a larger printer (≥370mm × 310mm build volume), you can use the original `raspberry-pi-touchscreen-case.scad` file for a single-piece print.

## File Reference

- `part1.stl` - Bottom-left section
- `part2.stl` - Bottom-right section  
- `part3.stl` - Top-left section
- `part4.stl` - Top-right section
- `raspberry-pi-touchscreen-case-modular.scad` - Source file (modify `part_to_render` variable to regenerate individual parts)

## Notes

- Each part is designed to be self-supporting (no supports needed)
- Connector pins may need light sanding for perfect fit
- Assembly is easier with two people (one to hold, one to glue)
- Test fit components before final gluing
- Mounting holes are split across parts - ensure proper alignment when assembling
