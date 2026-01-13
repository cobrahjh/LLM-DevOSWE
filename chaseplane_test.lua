-- ChasePlane LVAR Discovery Script for FSUIPC7
-- Save this as: Documents\FSUIPC7\chaseplane_test.lua
-- Run in FSUIPC: Buttons+Switches > assign a key to "Lua chaseplane_test"

-- Test writing to p42_cp_inputs to find which one triggers Cinematics
-- Watch your ChasePlane mode change!

local test_index = 0  -- Change this to test different inputs (0-99)

function write_lvar(name, value)
    ipc.writeLvar(name, value)
end

-- Write 1 to trigger, then 0 to reset
local lvar_name = "p42_cp_inputs_" .. string.format("%02d", test_index)
ipc.log("Testing: " .. lvar_name)

write_lvar(lvar_name, 1)
ipc.sleep(100)
write_lvar(lvar_name, 0)

ipc.log("Done testing " .. lvar_name)
