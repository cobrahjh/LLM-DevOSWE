/**
 * Kitt's Insights Management System
 * Handles linking insights to todo tasks and maintaining the insights log
 */

const fs = require('fs');
const path = require('path');

class KittInsights {
    constructor() {
        this.insightsLogPath = path.join(__dirname, '../logs/kitt-insights.log');
        this.todosPath = path.join(__dirname, '../logs/todos.json');
        this.insightCounter = this.getNextInsightId();
    }

    /**
     * Add a new insight and optionally link it to a todo task
     */
    addInsight(content, todoId = null, priority = 'MEDIUM', category = 'GENERAL') {
        const timestamp = new Date().toISOString();
        const insightId = `INSIGHT-${String(this.insightCounter).padStart(3, '0')}`;
        
        const linkedId = todoId === 'null' ? 'GENERAL' : (todoId || 'GENERAL');
        const logEntry = `[${timestamp}] [${insightId}] [${linkedId}] [${priority}] - ${content}\n\n`;
        
        // Append to insights log
        fs.appendFileSync(this.insightsLogPath, logEntry);
        
        // If linked to a todo (and not 'null' string), update the todo with insight reference
        if (todoId && todoId !== 'null') {
            this.linkInsightToTodo(todoId, insightId, content);
        }
        
        this.insightCounter++;
        return insightId;
    }

    /**
     * Link an insight to a specific todo task
     */
    linkInsightToTodo(todoId, insightId, insightContent) {
        try {
            const todos = JSON.parse(fs.readFileSync(this.todosPath, 'utf8'));
            let taskFound = false;

            // Search through all lists for the todo
            Object.keys(todos.lists).forEach(listName => {
                const task = todos.lists[listName].find(t => t.id === todoId);
                if (task) {
                    if (!task.insights) task.insights = [];
                    task.insights.push({
                        id: insightId,
                        content: insightContent,
                        timestamp: new Date().toISOString()
                    });
                    taskFound = true;
                }
            });

            if (taskFound) {
                fs.writeFileSync(this.todosPath, JSON.stringify(todos, null, 2));
                console.log(`Insight ${insightId} linked to task ${todoId}`);
            } else {
                console.warn(`Todo task ${todoId} not found`);
            }
        } catch (error) {
            console.error('Error linking insight to todo:', error);
        }
    }

    /**
     * Get insights for a specific todo task
     */
    getInsightsForTodo(todoId) {
        try {
            const todos = JSON.parse(fs.readFileSync(this.todosPath, 'utf8'));
            
            for (const listName of Object.keys(todos.lists)) {
                const task = todos.lists[listName].find(t => t.id === todoId);
                if (task) {
                    return task.insights || [];
                }
            }
            return [];
        } catch (error) {
            console.error('Error getting insights for todo:', error);
            return [];
        }
    }

    /**
     * Get all insights from the log
     */
    getAllInsights() {
        try {
            const logContent = fs.readFileSync(this.insightsLogPath, 'utf8');
            const lines = logContent.split('\n').filter(line => line.startsWith('['));
            
            return lines.map(line => {
                const match = line.match(/^\[(.*?)\] \[(.*?)\] \[(.*?)\] \[(.*?)\] - (.*)$/);
                if (match) {
                    return {
                        timestamp: match[1],
                        insightId: match[2],
                        linkedTodoId: match[3] !== 'GENERAL' ? match[3] : null,
                        priority: match[4],
                        content: match[5].trim()
                    };
                }
                return null;
            }).filter(Boolean);
        } catch (error) {
            console.error('Error reading insights log:', error);
            return [];
        }
    }

    /**
     * Get the next insight ID number
     */
    getNextInsightId() {
        try {
            const insights = this.getAllInsights();
            if (insights.length === 0) return 1;
            
            const lastId = Math.max(...insights.map(i => {
                const match = i.insightId.match(/INSIGHT-(\d+)/);
                return match ? parseInt(match[1]) : 0;
            }));
            
            return lastId + 1;
        } catch (error) {
            return 1; // Safe fallback
        }
    }

    /**
     * Generate insight report
     */
    generateInsightReport() {
        const insights = this.getAllInsights();
        const linkedInsights = insights.filter(i => i.linkedTodoId);
        const generalInsights = insights.filter(i => !i.linkedTodoId);
        
        let report = `# Kitt's Insights Report\n`;
        report += `Generated: ${new Date().toISOString()}\n\n`;
        report += `## Summary\n`;
        report += `- Total Insights: ${insights.length}\n`;
        report += `- Linked to Tasks: ${linkedInsights.length}\n`;
        report += `- General Insights: ${generalInsights.length}\n\n`;
        
        if (insights.length > 0) {
            report += `## High Priority Insights\n`;
            insights.filter(i => i.priority === 'HIGH' || i.priority === 'CRITICAL')
                   .forEach(insight => {
                       report += `- **${insight.insightId}** (${insight.priority})`;
                       if (insight.linkedTodoId) report += ` [Task: ${insight.linkedTodoId}]`;
                       report += `\n  ${insight.content.substring(0, 100)}...\n\n`;
                   });

            report += `## Recent Insights (Last 5)\n`;
            insights.slice(-5).reverse().forEach(insight => {
                report += `- **${insight.insightId}** [${insight.priority}]`;
                if (insight.linkedTodoId) report += ` [Task: ${insight.linkedTodoId}]`;
                report += `\n  ${insight.content.substring(0, 150)}...\n`;
            });
        }

        return report;
    }
}

module.exports = KittInsights;

// CLI usage
if (require.main === module) {
    const insights = new KittInsights();
    const args = process.argv.slice(2);
    
    if (args[0] === 'add') {
        const content = args[1];
        const todoId = args[2] || null;
        const priority = args[3] || 'MEDIUM';
        const insightId = insights.addInsight(content, todoId, priority);
        console.log(`Added insight: ${insightId}`);
    } else if (args[0] === 'report') {
        console.log(insights.generateInsightReport());
    } else if (args[0] === 'list') {
        const allInsights = insights.getAllInsights();
        allInsights.forEach(insight => {
            console.log(`${insight.insightId} [${insight.priority}] - ${insight.content.substring(0, 80)}...`);
        });
    } else {
        console.log('Usage:');
        console.log('  node kitt-insights.js add "insight content" [todoId] [priority]');
        console.log('  node kitt-insights.js report');
        console.log('  node kitt-insights.js list');
    }
}