
using raven.hr as hr from '../db/schema';

@path: 'employee'
service EmployeeService {
    entity Departments as projection on hr.Departments;
    entity Employees as projection on hr.Employees;
}

