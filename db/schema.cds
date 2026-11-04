
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
