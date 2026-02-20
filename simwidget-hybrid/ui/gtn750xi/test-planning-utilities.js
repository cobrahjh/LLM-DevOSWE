/**
 * GTN750Xi Planning Utilities Test Suite
 * Run in browser console at http://192.168.1.42:8080/ui/gtn750xi/
 */

class PlanningUtilitiesTest {
    constructor() {
        this.results = [];
    }

    async runAll() {
        console.log('🧪 GTN750Xi Planning Utilities Test Suite');
        console.log('==========================================\n');

        await this.testVCALC();
        await this.testTripPlanning();
        await this.testFuelPlanning();
        await this.testDaltTasWinds();
        await this.testChecklists();

        this.printResults();
    }

    async testVCALC() {
        console.log('Testing VCALC...');
        const passed = [];
        const failed = [];

        try {
            // Check page exists
            const page = document.getElementById('page-vcalc');
            if (!page) throw new Error('Page element not found');
            passed.push('Page element exists');

            // Check class is defined
            if (typeof VcalcPage === 'undefined') throw new Error('VcalcPage class not defined');
            passed.push('VcalcPage class defined');

            // Check inputs exist
            const inputs = ['vcalc-target-alt', 'vcalc-alt-type', 'vcalc-vs-profile', 'vcalc-offset', 'vcalc-offset-dir', 'vcalc-target-wpt'];
            inputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Input ${id} not found`);
            });
            passed.push('All input elements exist');

            // Check outputs exist
            const outputs = ['vcalc-status', 'vcalc-vs-required', 'vcalc-time-tod', 'vcalc-dist-tod'];
            outputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Output ${id} not found`);
            });
            passed.push('All output elements exist');

            this.results.push({ name: 'VCALC', passed, failed });
        } catch (e) {
            failed.push(e.message);
            this.results.push({ name: 'VCALC', passed, failed });
        }
    }

    async testTripPlanning() {
        console.log('Testing Trip Planning...');
        const passed = [];
        const failed = [];

        try {
            const page = document.getElementById('page-trip-planning');
            if (!page) throw new Error('Page element not found');
            passed.push('Page element exists');

            if (typeof TripPlanningPage === 'undefined') throw new Error('TripPlanningPage class not defined');
            passed.push('TripPlanningPage class defined');

            const inputs = ['trip-mode', 'trip-p-pos', 'trip-from-wpt', 'trip-to-wpt', 'trip-depart-time', 'trip-ground-speed'];
            inputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Input ${id} not found`);
            });
            passed.push('All input elements exist');

            const outputs = ['trip-result-dtk', 'trip-result-dis', 'trip-result-ete', 'trip-result-eta', 'trip-result-esa'];
            outputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Output ${id} not found`);
            });
            passed.push('All output elements exist');

            this.results.push({ name: 'Trip Planning', passed, failed });
        } catch (e) {
            failed.push(e.message);
            this.results.push({ name: 'Trip Planning', passed, failed });
        }
    }

    async testFuelPlanning() {
        console.log('Testing Fuel Planning...');
        const passed = [];
        const failed = [];

        try {
            const page = document.getElementById('page-fuel-planning');
            if (!page) throw new Error('Page element not found');
            passed.push('Page element exists');

            if (typeof FuelPlanningPage === 'undefined') throw new Error('FuelPlanningPage class not defined');
            passed.push('FuelPlanningPage class defined');

            const inputs = ['fuel-mode', 'fuel-est-remaining', 'fuel-flow', 'fuel-ground-speed', 'fuel-use-sensor'];
            inputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Input ${id} not found`);
            });
            passed.push('All input elements exist');

            const outputs = ['fuel-result-required', 'fuel-result-after', 'fuel-result-reserve', 'fuel-result-range', 'fuel-result-efficiency', 'fuel-result-endurance'];
            outputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Output ${id} not found`);
            });
            passed.push('All output elements exist');

            this.results.push({ name: 'Fuel Planning', passed, failed });
        } catch (e) {
            failed.push(e.message);
            this.results.push({ name: 'Fuel Planning', passed, failed });
        }
    }

    async testDaltTasWinds() {
        console.log('Testing DALT/TAS/Winds...');
        const passed = [];
        const failed = [];

        try {
            const page = document.getElementById('page-dalt-tas-winds');
            if (!page) throw new Error('Page element not found');
            passed.push('Page element exists');

            if (typeof DaltTasWindsPage === 'undefined') throw new Error('DaltTasWindsPage class not defined');
            passed.push('DaltTasWindsPage class defined');

            const inputs = ['dalt-indicated-alt', 'dalt-baro', 'dalt-cas', 'dalt-tat', 'dalt-hdg', 'dalt-trk', 'dalt-ground-speed'];
            inputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Input ${id} not found`);
            });
            passed.push('All input elements exist');

            const outputs = ['dalt-result-density', 'dalt-result-tas', 'dalt-result-wind-dir', 'dalt-result-wind-speed', 'dalt-result-headwind'];
            outputs.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Output ${id} not found`);
            });
            passed.push('All output elements exist');

            this.results.push({ name: 'DALT/TAS/Winds', passed, failed });
        } catch (e) {
            failed.push(e.message);
            this.results.push({ name: 'DALT/TAS/Winds', passed, failed });
        }
    }

    async testChecklists() {
        console.log('Testing Checklists...');
        const passed = [];
        const failed = [];

        try {
            const page = document.getElementById('page-checklists');
            if (!page) throw new Error('Page element not found');
            passed.push('Page element exists');

            if (typeof ChecklistsPage === 'undefined') throw new Error('ChecklistsPage class not defined');
            passed.push('ChecklistsPage class defined');

            const elements = ['checklist-group-name', 'checklist-name', 'checklist-items', 'checklist-status'];
            elements.forEach(id => {
                if (!document.getElementById(id)) throw new Error(`Element ${id} not found`);
            });
            passed.push('All UI elements exist');

            this.results.push({ name: 'Checklists', passed, failed });
        } catch (e) {
            failed.push(e.message);
            this.results.push({ name: 'Checklists', passed, failed });
        }
    }

    printResults() {
        console.log('\n📊 Test Results:');
        console.log('================\n');

        let totalPassed = 0;
        let totalFailed = 0;

        this.results.forEach(test => {
            const passCount = test.passed.length;
            const failCount = test.failed.length;
            totalPassed += passCount;
            totalFailed += failCount;

            const status = failCount === 0 ? '✅' : '❌';
            console.log(`${status} ${test.name}`);
            test.passed.forEach(p => console.log(`  ✓ ${p}`));
            test.failed.forEach(f => console.log(`  ✗ ${f}`));
            console.log('');
        });

        console.log(`Total: ${totalPassed} passed, ${totalFailed} failed`);
        console.log(`Success Rate: ${totalFailed === 0 ? '100%' : ((totalPassed / (totalPassed + totalFailed)) * 100).toFixed(1) + '%'}`);
    }
}

// Run tests
console.log('To run tests, execute: new PlanningUtilitiesTest().runAll()');
