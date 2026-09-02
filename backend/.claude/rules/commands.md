---
description: Build, run, and test commands — Docker Postgres, Maven, and the required JDK 17 setup
alwaysApply: true
---

# Commands

```bash
docker compose up -d        # start Postgres 16 (db: myassets, user: myuser/mypassword, port 5432)
mvn spring-boot:run         # run app on port 8081 (requires Postgres running)
mvn clean package           # build (skip tests with -DskipTests)
mvn test                    # run all tests
mvn test -Dtest=SomeClassTest#methodName   # run a single test
```

## JDK requirement

Build with JDK 17 — the system Maven defaults to JDK 25, which Lombok 1.18.36 does not support (`TypeTag :: UNKNOWN` error):

```bash
export JAVA_HOME=/Users/namnlh/Library/Java/JavaVirtualMachines/ms-17.0.18/Contents/Home
```

- `./mvnw` is broken (missing `.mvn/wrapper/`); use system `mvn`.
- There is currently no `src/test` directory.