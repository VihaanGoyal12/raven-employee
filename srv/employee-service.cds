using raven.hr as hr from '../db/schema';

@path: 'employee'
@requires: 'any'
service EmployeeService {
    entity Departments      as projection on hr.Departments;
    entity EmployeeStatuses as projection on hr.EmployeeStatuses;

    @odata.draft.enabled
    entity Employees as projection on hr.Employees {
        *,
        firstName || ' ' || lastName as fullName : String(81),
        case status
            when 'Active'   then 3
            when 'On Leave' then 2
            else 0
        end as statusCriticality : Integer
    };
}
