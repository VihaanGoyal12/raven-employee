
namespace raven.hr;

entity Departments {
    key ID        : UUID;
    name          : String(40) @mandatory;
    costCenter    : String(10);
}

entity Employees {
    key ID            : UUID;
    employeeCode      : String(10) @mandatory;
    firstName         : String(40) @mandatory;
    lastName          : String(40) @mandatory;
    email             : String(100) @mandatory;
    phone             : String(15);
    dateOfJoining     : Date;

    department        : Association to Departments;

    status            : String(20) default 'Active';
}

entity EmployeeStatuses {
    key code : String(20);
}

annotate Employees with {
    employeeCode  @title: 'Employee Code';
    firstName     @title: 'First Name';
    lastName      @title: 'Last Name';
    email         @title: 'Email';
    phone         @title: 'Phone';
    dateOfJoining @title: 'Date of Joining';
    department    @title: 'Department';
    status        @title: 'Status';
};

