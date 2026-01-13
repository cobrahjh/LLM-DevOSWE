-- ============================================
-- ChasePlane LVAR Auto-Discovery Script
-- For FSUIPC7 - Save to Documents\FSUIPC7\
-- ============================================
-- 
-- This script automatically discovers which p42_cp_inputs_XX
-- triggers each ChasePlane function by monitoring mode changes.
--
-- INSTRUCTIONS:
-- 1. Save this file as: Documents\FSUIPC7\cp_discover.lua
-- 2. In FSUIPC7: Add-ons > Lua Plug-Ins > [cp_discover]
-- 3. Check FSUIPC7.log for results
--
-- The script will test inputs 0-50 and report which ones
-- cause the p42_cp_mode to change.
-- ============================================

function main()
    ipc.log("=== ChasePlane Input Discovery ===")
    ipc.log("Testing inputs 0-50...")
    
    -- Get initial mode
    local initial_mode = ipc.readLvar("p42_cp_mode")
    ipc.log("Initial mode: " .. tostring(initial_mode))
    
    -- Test each input
    for i = 0, 50 do
        local lvar_name = string.format("p42_cp_inputs_%02d", i)
        
        -- Trigger the input
        ipc.writeLvar(lvar_name, 1)
        ipc.sleep(100)
        ipc.writeLvar(lvar_name, 0)
        ipc.sleep(100)
        
        -- Check if mode changed
        local new_mode = ipc.readLvar("p42_cp_mode")
        
        if new_mode ~= initial_mode then
            ipc.log(">>> INPUT " .. i .. " changed mode to: " .. tostring(new_mode))
            -- Reset to initial mode by pressing again
            ipc.writeLvar(lvar_name, 1)
            ipc.sleep(100)
            ipc.writeLvar(lvar_name, 0)
            ipc.sleep(100)
        end
        
        -- Small delay between tests
        ipc.sleep(50)
    end
    
    ipc.log("=== Discovery Complete ===")
    ipc.log("Check above for inputs that changed the mode!")
end

main()
