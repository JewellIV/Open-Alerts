// 3D Printable Case for Raspberry Pi 5 + MAGEX Touchscreen Monitor
// Parametric design - adjust variables at top to customize

// ============================================
// CONFIGURATION PARAMETERS
// ============================================

// Raspberry Pi 5 Case Dimensions (official case)
pi5_length = 98.5;  // mm
pi5_width = 70.3;   // mm
pi5_height = 33;    // mm

// MAGEX Touchscreen Dimensions (15.6" model - adjust if different size)
// Screen dimensions (approximate - adjust based on your model)
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
snap_fit_tolerance = 0.3; // mm - snap fit clearance
corner_radius = 5;        // mm - rounded corners

// Wall Mount Parameters
mount_hole_diameter = 5;      // mm - mounting screw hole diameter
mount_hole_spacing_x = 200;   // mm - horizontal spacing between mount holes
mount_hole_spacing_y = 150;   // mm - vertical spacing between mount holes
mount_hole_offset = 20;       // mm - offset from edges for mounting holes
mount_hole_depth = 10;        // mm - depth of countersunk area (for flush mounting)

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

// ============================================
// MAIN CASE BASE
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

module base_plate() {
    difference() {
        rounded_box(case_length, case_width, base_height, corner_radius);
        
        // Ventilation holes for Pi5 compartment
        for (x = [wall_thickness + vent_spacing : vent_spacing : pi5_comp_length - vent_spacing]) {
            for (y = [wall_thickness + vent_spacing : vent_spacing : pi5_comp_width - vent_spacing]) {
                translate([x, y, -0.1])
                    cylinder(h = base_height + 0.2, d = vent_hole_size, $fn = 16);
            }
        }
    }
}

// ============================================
// PI5 COMPARTMENT WALLS
// ============================================

module pi5_compartment_walls() {
    // Back wall
    translate([wall_thickness, wall_thickness, base_height])
        cube([pi5_comp_length, wall_thickness, pi5_comp_height]);
    
    // Left wall
    translate([wall_thickness, wall_thickness, base_height])
        cube([wall_thickness, pi5_comp_width, pi5_comp_height]);
    
    // Right wall
    translate([wall_thickness + pi5_comp_length - wall_thickness, wall_thickness, base_height])
        cube([wall_thickness, pi5_comp_width, pi5_comp_height]);
    
    // Front wall (partial - with opening for cables)
    translate([wall_thickness, wall_thickness + pi5_comp_width - wall_thickness, base_height])
        cube([pi5_comp_length * 0.7, wall_thickness, pi5_comp_height]);
    
    // Cable opening in front wall
    translate([wall_thickness + pi5_comp_length * 0.7, wall_thickness + pi5_comp_width - wall_thickness, base_height])
        cube([pi5_comp_length * 0.3, wall_thickness, pi5_comp_height * 0.6]);
}

// ============================================
// SCREEN COMPARTMENT WALLS
// ============================================

module screen_compartment_walls() {
    screen_x_offset = wall_thickness;
    screen_y_offset = wall_thickness + pi5_comp_width + wall_thickness + clearance;
    
    // Back wall
    translate([screen_x_offset, screen_y_offset, base_height])
        cube([screen_comp_length, wall_thickness, screen_comp_depth]);
    
    // Left wall
    translate([screen_x_offset, screen_y_offset, base_height])
        cube([wall_thickness, screen_comp_width, screen_comp_depth]);
    
    // Right wall
    translate([screen_x_offset + screen_comp_length - wall_thickness, screen_y_offset, base_height])
        cube([wall_thickness, screen_comp_width, screen_comp_depth]);
    
    // Front wall (with opening for screen)
    translate([screen_x_offset, screen_y_offset + screen_comp_width - wall_thickness, base_height])
        cube([screen_comp_length, wall_thickness, screen_comp_depth * 0.3]);
    
    // Screen opening
    translate([screen_x_offset + wall_thickness, screen_y_offset + screen_comp_width - wall_thickness, base_height])
        cube([screen_comp_length - (wall_thickness * 2), wall_thickness, screen_comp_depth]);
}

// ============================================
// VENTILATION HOLES
// ============================================

module ventilation_holes() {
    // Pi5 compartment ventilation
    pi5_x_center = wall_thickness + pi5_comp_length / 2;
    pi5_y_center = wall_thickness + pi5_comp_width / 2;
    
    // Side ventilation holes
    for (y = [pi5_y_center - 20 : 10 : pi5_y_center + 20]) {
        // Left side
        translate([wall_thickness, y, base_height + pi5_comp_height / 2])
            rotate([0, 90, 0])
                cylinder(h = wall_thickness + 0.2, d = vent_hole_size, $fn = 16);
        
        // Right side
        translate([wall_thickness + pi5_comp_length - wall_thickness, y, base_height + pi5_comp_height / 2])
            rotate([0, 90, 0])
                cylinder(h = wall_thickness + 0.2, d = vent_hole_size, $fn = 16);
    }
}

// ============================================
// CABLE MANAGEMENT
// ============================================

module cable_openings() {
    // Opening between compartments for cables
    translate([wall_thickness + pi5_comp_length / 2 - 10, 
               wall_thickness + pi5_comp_width, 
               base_height])
        cube([20, wall_thickness + clearance, 15]);
    
    // USB/HDMI opening in front
    translate([wall_thickness + pi5_comp_length - 30, 
               wall_thickness + pi5_comp_width - wall_thickness, 
               base_height])
        cube([25, wall_thickness + 0.2, 12]);
}

// ============================================
// WALL MOUNTING HOLES
// ============================================

module wall_mount_holes() {
    // Calculate center position for mounting holes
    mount_center_x = case_length / 2;
    mount_center_y = case_width / 2;
    
    // Four mounting holes in rectangular pattern
    for (x_offset = [-mount_hole_spacing_x/2, mount_hole_spacing_x/2]) {
        for (y_offset = [-mount_hole_spacing_y/2, mount_hole_spacing_y/2]) {
            // Main mounting hole (through hole)
            translate([mount_center_x + x_offset, 
                      mount_center_y + y_offset, 
                      -0.1])
                cylinder(h = base_height + mount_hole_depth + 0.2, 
                        d = mount_hole_diameter, 
                        $fn = 32);
            
            // Countersunk area for flush mounting (optional - for flat head screws)
            translate([mount_center_x + x_offset, 
                      mount_center_y + y_offset, 
                      base_height - mount_hole_depth])
                cylinder(h = mount_hole_depth + 0.1, 
                        d1 = mount_hole_diameter, 
                        d2 = mount_hole_diameter * 2, 
                        $fn = 32);
        }
    }
}

// ============================================
// MAIN ASSEMBLY
// ============================================

module main_case() {
    difference() {
        union() {
            base_plate();
            pi5_compartment_walls();
            screen_compartment_walls();
        }
        ventilation_holes();
        cable_openings();
        wall_mount_holes();
    }
}

// ============================================
// RENDER
// ============================================

main_case();
