-- CreateTable
CREATE TABLE "Student" (
    "studentNumber" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "simUsername" TEXT NOT NULL,
    "simPassword" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Major" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "semester" TEXT,
    "date" DATETIME
);
