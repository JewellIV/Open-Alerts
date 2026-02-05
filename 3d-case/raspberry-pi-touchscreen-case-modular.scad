// 3D Printable Case for Raspberry Pi 5 + MAGEX Touchscreen Monitor
// MODULAR VERSION - Split into printable sections for smaller build volumes
// Designed for 250mm × 250mm × 260mm build volume

// ============================================
// CONFIGURATION PARAMETERS
// ============================================

// Raspberry Pi 5 Case Dimensions (official case)
pi5_length = 98.5;  // mm
pi5_width = 70.3;   // mm
pi5_height = 33;    // mm

// MAGEX Touchscreen Dimensions (15.6" model - adjust if different size)
screen_width = 360;   // mm (15.6" screen width)
screen_height = 220;  // mm (15.6" screen height)
screen_thickness = 20; // mm (including bezel)

// Case Design Parameters
wall_thickness = 3;      // mm - wall thickness
base_height = 5;         // mm - base plate thickness
clearance = 2;           // mm - clearance around components
vent_hole_size = 5;      // mm - ventilation hole diameter
vent_spacing = 15;       // mm - spacing between vent holes

// Assembly Parameters
corner_radius = 5;        // mm - rounded corners

// Wall Mount Parameters
mount_hole_diameter = 5;      // mm - mounting screw hole diameter
mount_hole_spacing_x = 200;   // mm - horizontal spacing between mount holes
mount_hole_spacing_y = 150;   // mm - vertical spacing between mount holes
mount_hole_depth = 10;        // mm - depth of countersunk area

// Modular Assembly Parameters
build_volume_x = 250;    // mm - your printer's X build volume
build_volume_y = 250;    // mm - your printer's Y build volume
build_volume_z = 260;    // mm - your printer's Z build volume
connector_diameter = 4;  // mm - connector pin diameter
connector_length = 10;   // mm - connector pin length
connector_clearance = 0.2; // mm - clearance for connectors

// Part Selection (set which part to render)
// Options: "part1", "part2", "part3", "part4", "all"
part_to_render = "part1";

// ============================================
// CALCULATED DIMENSIONS
// ============================================

// Overall case dimensions
case_length = screen_width + (wall_thickness * 2) + clearance;
case_width = screen_height + pi5_width + (wall_thickness * 3) + (clearance * 2);
case_height = max(pi5_height, screen_thickness) + base_height + clearance + wall_thickness;

// Pi5 compartment dimensions
pi5_comp_length = pi5_length + (clearance * 2);
pi5_comp_width = pi5_width + (clearance * 2);
pi5_comp_height = pi5_height + clearance;

// Screen compartment dimensions
screen_comp_length = screen_width + (clearance * 2);
screen_comp_width = screen_height + (clearance * 2);
screen_comp_depth = screen_thickness + clearance;

// Calculate number of parts needed
parts_x = ceil(case_length / (build_volume_x - 10)); // -10mm for margin
parts_y = ceil(case_width / (build_volume_y - 10));
total_parts = parts_x * parts_y;

// Split positions
split_x = case_length / parts_x;
split_y = case_width / parts_y;

echo("Case dimensions: ", case_length, " × ", case_width, " × ", case_height);
echo("Parts needed: ", parts_x, " × ", parts_y, " = ", total_parts, " parts");
echo("Split positions X: ", split_x, "mm intervals");
echo("Split positions Y: ", split_y, "mm intervals");

// ============================================
// HELPER MODULES
// ============================================

module rounded_box(length, width, height, radius) {
    hull() {
        for (x = [radius, length - radius]) {
            for (y = [radius, width - radius]) {
                translate([x, y, 0])
                    cylinder(h = height, r = radius, $fn = 32);
            }
        }
    }
}

module connector_pin() {
    cylinder(h = connector_length, d = connector_diameter, $fn = 16);
}

module connector_hole() {
    cylinder(h = connector_length + 1, d = connector_diameter + connector_clearance, $fn = 16);
}

// ============================================
// BASE PLATE SECTION
// ============================================

module base_plate_section(x_start, x_end, y_start, y_end) {
    difference() {
        intersection() {
            rounded_box(case_length, case_width, base_height, corner_radius);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, base_height + 1]);
        }
        
        // Ventilation holes for Pi5 compartment (only in Pi5 area)
        if (y_start < wall_thickness + pi5_comp_width && y_end > wall_thickness) {
            for (x = [max(x_start, wall_thickness + vent_spacing) : vent_spacing : min(x_end, pi5_comp_length - vent_spacing)]) {
                for (y = [max(y_start, wall_thickness + vent_spacing) : vent_spacing : min(y_end, wall_thickness + pi5_comp_width - vent_spacing)]) {
                    translate([x, y, -0.1])
                        cylinder(h = base_height + 0.2, d = vent_hole_size, $fn = 16);
                }
            }
        }
        
        // Mounting holes (only in sections that contain them)
        mount_center_x = case_length / 2;
        mount_center_y = case_width / 2;
        
        for (x_offset = [-mount_hole_spacing_x/2, mount_hole_spacing_x/2]) {
            for (y_offset = [-mount_hole_spacing_y/2, mount_hole_spacing_y/2]) {
                hole_x = mount_center_x + x_offset;
                hole_y = mount_center_y + y_offset;
                
                if (hole_x >= x_start && hole_x <= x_end && hole_y >= y_start && hole_y <= y_end) {
                    translate([hole_x, hole_y, -0.1])
                        cylinder(h = base_height + mount_hole_depth + 0.2, d = mount_hole_diameter, $fn = 32);
                    
                    translate([hole_x, hole_y, base_height - mount_hole_depth])
                        cylinder(h = mount_hole_depth + 0.1, d1 = mount_hole_diameter, d2 = mount_hole_diameter * 2, $fn = 32);
                }
            }
        }
        
        // Connector holes on split edges
        // Right edge connectors
        if (x_end >= case_length - 1) {
            for (y = [y_start + 20 : 30 : y_end - 20]) {
                translate([x_end - base_height/2, y, base_height/2])
                    rotate([0, 90, 0])
                        connector_hole();
            }
        }
        // Left edge connectors (for parts 2 and 4)
        if (x_start <= 1) {
            for (y = [y_start + 20 : 30 : y_end - 20]) {
                translate([x_start + base_height/2, y, base_height/2])
                    rotate([0, -90, 0])
                        connector_hole();
            }
        }
        // Top edge connectors
        if (y_end >= case_width - 1) {
            for (x = [x_start + 20 : 30 : x_end - 20]) {
                translate([x, y_end - base_height/2, base_height/2])
                    rotate([90, 0, 0])
                        connector_hole();
            }
        }
        // Bottom edge connectors (for parts 3 and 4)
        if (y_start <= 1) {
            for (x = [x_start + 20 : 30 : x_end - 20]) {
                translate([x, y_start + base_height/2, base_height/2])
                    rotate([-90, 0, 0])
                        connector_hole();
            }
        }
    }
    
    // Connector pins on opposite edges
    // Left edge pins (for parts 1 and 3)
    if (x_start > 1) {
        for (y = [y_start + 20 : 30 : y_end - 20]) {
            translate([x_start, y, base_height/2])
                rotate([0, -90, 0])
                    connector_pin();
        }
    }
    // Bottom edge pins (for parts 1 and 2)
    if (y_start > 1) {
        for (x = [x_start + 20 : 30 : x_end - 20]) {
            translate([x, y_start, base_height/2])
                rotate([-90, 0, 0])
                    connector_pin();
        }
    }
}

// ============================================
// WALLS SECTION
// ============================================

module walls_section(x_start, x_end, y_start, y_end) {
    // Pi5 compartment walls
    pi5_x_start = wall_thickness;
    pi5_x_end = wall_thickness + pi5_comp_length;
    pi5_y_start = wall_thickness;
    pi5_y_end = wall_thickness + pi5_comp_width;
    
    // Back wall
    if (y_start <= pi5_y_start && y_end >= pi5_y_start + wall_thickness) {
        intersection() {
            translate([pi5_x_start, pi5_y_start, base_height])
                cube([pi5_comp_length, wall_thickness, pi5_comp_height]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Left wall
    if (x_start <= pi5_x_start && x_end >= pi5_x_start + wall_thickness) {
        intersection() {
            translate([pi5_x_start, pi5_y_start, base_height])
                cube([wall_thickness, pi5_comp_width, pi5_comp_height]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Right wall
    if (x_start <= pi5_x_end - wall_thickness && x_end >= pi5_x_end) {
        intersection() {
            translate([pi5_x_end - wall_thickness, pi5_y_start, base_height])
                cube([wall_thickness, pi5_comp_width, pi5_comp_height]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Front wall (partial - with opening for cables)
    if (y_start <= pi5_y_end - wall_thickness && y_end >= pi5_y_end) {
        intersection() {
            translate([pi5_x_start, pi5_y_end - wall_thickness, base_height])
                cube([pi5_comp_length * 0.7, wall_thickness, pi5_comp_height]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Screen compartment walls
    screen_x_start = wall_thickness;
    screen_x_end = wall_thickness + screen_comp_length;
    screen_y_start = wall_thickness + pi5_comp_width + wall_thickness + clearance;
    screen_y_end = screen_y_start + screen_comp_width;
    
    // Back wall
    if (y_start <= screen_y_start && y_end >= screen_y_start + wall_thickness) {
        intersection() {
            translate([screen_x_start, screen_y_start, base_height])
                cube([screen_comp_length, wall_thickness, screen_comp_depth]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Left wall
    if (x_start <= screen_x_start && x_end >= screen_x_start + wall_thickness) {
        intersection() {
            translate([screen_x_start, screen_y_start, base_height])
                cube([wall_thickness, screen_comp_width, screen_comp_depth]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Right wall
    if (x_start <= screen_x_end - wall_thickness && x_end >= screen_x_end) {
        intersection() {
            translate([screen_x_end - wall_thickness, screen_y_start, base_height])
                cube([wall_thickness, screen_comp_width, screen_comp_depth]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
    
    // Front wall (with opening for screen)
    if (y_start <= screen_y_end - wall_thickness && y_end >= screen_y_end) {
        intersection() {
            translate([screen_x_start, screen_y_end - wall_thickness, base_height])
                cube([screen_comp_length, wall_thickness, screen_comp_depth * 0.3]);
            translate([x_start, y_start, 0])
                cube([x_end - x_start, y_end - y_start, case_height + 1]);
        }
    }
}

// ============================================
// VENTILATION AND CABLE OPENINGS
// ============================================

module ventilation_holes_section(x_start, x_end, y_start, y_end) {
    pi5_x_center = wall_thickness + pi5_comp_length / 2;
    pi5_y_center = wall_thickness + pi5_comp_width / 2;
    
    // Side ventilation holes
    for (y = [pi5_y_center - 20 : 10 : pi5_y_center + 20]) {
        // Left side
        if (x_start <= wall_thickness && x_end >= wall_thickness + wall_thickness) {
            translate([wall_thickness, y, base_height + pi5_comp_height / 2])
                rotate([0, 90, 0])
                    cylinder(h = wall_thickness + 0.2, d = vent_hole_size, $fn = 16);
        }
        
        // Right side
        if (x_start <= wall_thickness + pi5_comp_length - wall_thickness && x_end >= wall_thickness + pi5_comp_length) {
            translate([wall_thickness + pi5_comp_length - wall_thickness, y, base_height + pi5_comp_height / 2])
                rotate([0, 90, 0])
                    cylinder(h = wall_thickness + 0.2, d = vent_hole_size, $fn = 16);
        }
    }
}

module cable_openings_section(x_start, x_end, y_start, y_end) {
    // Opening between compartments for cables
    cable_x = wall_thickness + pi5_comp_length / 2 - 10;
    cable_y = wall_thickness + pi5_comp_width;
    
    if (x_start <= cable_x + 20 && x_end >= cable_x && 
        y_start <= cable_y + wall_thickness + clearance && y_end >= cable_y) {
        translate([cable_x, cable_y, base_height])
            cube([20, wall_thickness + clearance, 15]);
    }
    
    // USB/HDMI opening in front
    usb_x = wall_thickness + pi5_comp_length - 30;
    usb_y = wall_thickness + pi5_comp_width - wall_thickness;
    
    if (x_start <= usb_x + 25 && x_end >= usb_x && 
        y_start <= usb_y + wall_thickness && y_end >= usb_y) {
        translate([usb_x, usb_y, base_height])
            cube([25, wall_thickness + 0.2, 12]);
    }
}

// ============================================
// PART ASSEMBLY
// ============================================

module part(x_part, y_part) {
    x_start = (x_part - 1) * split_x;
    x_end = min(x_part * split_x, case_length);
    y_start = (y_part - 1) * split_y;
    y_end = min(y_part * split_y, case_width);
    
    difference() {
        union() {
            base_plate_section(x_start, x_end, y_start, y_end);
            walls_section(x_start, x_end, y_start, y_end);
        }
        ventilation_holes_section(x_start, x_end, y_start, y_end);
        cable_openings_section(x_start, x_end, y_start, y_end);
    }
}

// ============================================
// RENDER SELECTED PART
// ============================================

if (part_to_render == "part1") {
    part(1, 1); // Bottom-left
} else if (part_to_render == "part2") {
    part(2, 1); // Bottom-right
} else if (part_to_render == "part3") {
    part(1, 2); // Top-left
} else if (part_to_render == "part4") {
    part(2, 2); // Top-right
} else if (part_to_render == "all") {
    // Render all parts (for visualization only)
    translate([0, 0, 0]) part(1, 1);
    translate([split_x + 5, 0, 0]) part(2, 1);
    translate([0, split_y + 5, 0]) part(1, 2);
    translate([split_x + 5, split_y + 5, 0]) part(2, 2);
} else {
    part(1, 1); // Default to part 1
}
