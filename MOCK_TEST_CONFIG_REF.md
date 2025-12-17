# Mock Test Configuration - Quick Reference

## Dropdown Options

### Departments
- CSE
- ECE
- EE
- ME
- CE
- IT
- DS

### Years
- 1st
- 2nd
- 3rd
- 4th

### Courses
- MTH1101
- MTH1102
- MTH2101
- MTH2102
- PHY1101
- CHE1101
- CSE1101
- etc.

## Data Structure
```typescript
{
  facultyName: "RB",
  topics: [
    {
      topic: "Matrix",
      enabled: true,
      deployments: [
        { department: "CSE", year: "1st", course: "MTH1101" },
        { department: "DS", year: "1st", course: "MTH1101" }
      ]
    }
  ]
}
```
