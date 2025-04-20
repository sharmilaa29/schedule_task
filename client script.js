frappe.ui.form.on('Task', {
    refresh(frm) {
        frm.add_custom_button('Allocate Employee', () => {
            frappe.call({
                method: 'schedule_task_app.custom_script.get_all_employees_with_conflicts',
                args: {
                    task: frm.doc.name,
                    start_date: frm.doc.exp_start_date,
                    end_date: frm.doc.exp_end_date
                },
                callback: function (r) {
                    if (r.message) {
                        show_employee_dialog(frm, r.message);
                    }
                }
            });
        });
    }
});

function show_employee_dialog(frm, employees) {
    const dialog = new frappe.ui.Dialog({
        title: 'Schedule Task',
        fields: [
            { fieldname: 'employee_list', fieldtype: 'HTML' }
        ],
        primary_action_label: 'Schedule',
        primary_action(values) {
            const selected = [];
            dialog.$wrapper.find('.emp-checkbox:checked').each(function () {
                selected.push($(this).val());
            });

            if (selected.length === 0) {
                frappe.msgprint("Please select at least one employee without conflicts.");
                return;
            }

            frappe.call({
                method: 'schedule_task_app.custom_script.schedule_multiple_employees',
                args: {
                    employees: selected,
                    task: frm.doc.name,
                    start_date: frm.doc.exp_start_date,
                    end_date: frm.doc.exp_end_date
                },
                callback: function (r) {
                    if (r.message) {
                        frappe.msgprint(`Timesheets created: ${r.message.map(t => `<a href="/app/timesheet/${t}" target="_blank">${t}</a>`).join(', ')}`);
                        dialog.hide();
                    }
                }
            });
        }
    });

    dialog.show();

    const plannedRange = `
        <p><b>Planned Daterange:</b> ${frappe.datetime.str_to_user(frm.doc.exp_start_date)} to ${frappe.datetime.str_to_user(frm.doc.exp_end_date)}</p>
    `;

    const empHtml = employees.map(emp => {
        const hasConflict = emp.conflicts.length > 0;
        return `
            <div class="emp-item" style="padding:8px; border-bottom:1px solid #eee;">
                <label style="display:flex;align-items:center;gap:6px;">
                    <input type="checkbox" class="emp-checkbox" value="${emp.name}" ${hasConflict ? 'disabled' : ''}>
                    <b>${emp.employee_name}</b> - ${emp.designation || '-'}
                </label>
                ${hasConflict ? `
                    <div style="color:red;">Overlaps with other tasks</div>
                    <ul style="margin:0;">${emp.conflicts.map(c => `
                        <li>${c.name} (${frappe.datetime.str_to_user(c.from_time)} - ${frappe.datetime.str_to_user(c.to_time)})</li>
                    `).join('')}</ul>
                ` : `<div style="color:green;">No conflicts</div>`}
            </div>
        `;
    }).join('');

    dialog.fields_dict.employee_list.$wrapper.html(`
        ${plannedRange}
        <div id="emp-list" style="max-height:400px; overflow-y:auto;">${empHtml}</div>
    `);
}

