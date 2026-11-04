# Raven Employee Directory

## 1. Project Overview

Raven Employee Directory is a RESTful employee management service built using SAP Cloud Application Programming Model (CAP).

It allows an organization to manage employee information and departments through OData V4 APIs.

## 2. Technology Stack

- SAP Cloud Application Programming Model (CAP)
- Node.js
- JavaScript
- CDS
- SQLite for local development
- SAP HANA for production deployment
- OData V4

## 3. Data Model

### Departments
- ID: UUID (Primary Key)
- name: String(40), mandatory
- costCenter: String(10)

### Employees
- ID: UUID (Primary Key)
- employeeCode: String(10), mandatory
- firstName: String(40), mandatory
- lastName: String(40), mandatory
- email: String(100), mandatory
- phone: String(15)
- dateOfJoining: Date
- department: Association to Departments
- status: String(20), default 'Active'

Each employee belongs to a department.

## 4. Business Validations

The service implements two validations before creating an employee:

- Email format validation. Invalid email addresses return HTTP 400.
- Duplicate employeeCode validation. Duplicate codes return HTTP 409.

## 5. API Endpoints

Base path: /odata/v4/employee

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | /Departments | Retrieve departments |
| POST | /Departments | Create a department |
| GET | /Employees | Retrieve employees |
| POST | /Employees | Create an employee |
| GET | /Employees(ID) | Retrieve an employee by ID |
| PATCH | /Employees(ID) | Update an employee |
| DELETE | /Employees(ID) | Delete an employee |

## 6. Project Structure

- db/schema.cds — Database entities and relationships
- db/data/ — CSV seed data
- srv/employee-service.cds — OData service definition
- srv/employee-service.js — Employee validation logic

## 7. Local Setup

Install dependencies:

    npm install

Deploy the local SQLite database:

    cds deploy --to sqlite:db.sqlite

Start the development server:

    cds watch

The service is available at:

    http://localhost:4004/odata/v4/employee

## 8. Testing

The API was tested using Postman.

Verified scenarios include:

- GET Departments — 200
- POST Department — 201
- POST Employee — 201
- Duplicate employeeCode — 409
- Invalid email — 400
- GET Employee by ID — 200
- PATCH Employee — 200
- DELETE Employee — 204
- GET deleted employee — 404

## 9. Deployment

## Deployment

The Employee Directory CAP service is deployed on SAP BTP Cloud Foundry using SAP HANA Cloud as the production database.

**Environment:** SAP BTP Cloud Foundry (Asia-Pacific – Singapore)

**Service URL:**
`https://f1de4b2dtrial-dev-raven-employee-directory-srv.cfapps.ap21.hana.ondemand.com`

**OData V4 endpoint:**
`https://f1de4b2dtrial-dev-raven-employee-directory-srv.cfapps.ap21.hana.ondemand.com/odata/v4/employee`

**Available entities:**
- `/Departments`
- `/Employees`

**Authentication:** XSUAA (OAuth 2.0 Client Credentials)

**Database:** SAP HANA Cloud

**Deployment status:** Successfully deployed and tested. All Day 1 API tests, including validation, update and deletion scenarios, passed.

