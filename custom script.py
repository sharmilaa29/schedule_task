from frappe.utils import get_datetime

@frappe.whitelist()
def get_all_employees_with_conflicts(task, start_date, end_date):
    start = get_datetime(start_date)
    end = get_datetime(end_date)

    employees = frappe.get_all("Employee", fields=["name", "employee_name", "designation"])
    result = []

    for emp in employees:
        conflicts = frappe.db.sql("""
            SELECT ts.name, d.from_time, d.to_time
            FROM `tabTimesheet` ts
            JOIN `tabTimesheet Detail` d ON ts.name = d.parent
            WHERE ts.employee = %s AND ((%s BETWEEN d.from_time AND d.to_time) OR (%s BETWEEN d.from_time AND d.to_time) OR (d.from_time BETWEEN %s AND %s))
        """, (emp.name, start, end, start, end), as_dict=True)

        result.append({
            "name": emp.name,
            "employee_name": emp.employee_name,
            "designation": emp.designation,
            "conflicts": conflicts
        })

    return result

@frappe.whitelist()
def schedule_multiple_employees(employees, task, start_date, end_date):
    employees = json.loads(employees)
    created_timesheets = []

    for emp in employees:
        ts = frappe.new_doc("Timesheet")
        ts.employee = emp
        ts.append("time_logs", {
            "activity_type": "Planning",
            "from_time": start_date,
            "to_time": end_date,
            "task": task,
            "hours": (get_datetime(end_date) - get_datetime(start_date)).total_seconds() / 3600
        })
        ts.insert()
        created_timesheets.append(ts.name)

        user_id = frappe.db.get_value("Employee", emp, "user_id")

        if user_id:
            todo = frappe.new_doc("ToDo")
            todo.allocated_to = user_id
            todo.reference_type = "Task"
            todo.reference_name = task
            todo.description = f"Complete assigned task between {start_date} and {end_date}"
            todo.date = nowdate()
            todo.assigned_by = frappe.session.user
            todo.insert(ignore_permissions=True)

    return created_timesheets

