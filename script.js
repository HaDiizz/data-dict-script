import express from "express";
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 7777;

app.use(express.json());

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: "postgres",
    port: 5432,
    logging: false,
  }
);

(async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected successfully");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
})();

app.get("/inspect", async (req, res) => {
  try {
    const queryInterface = sequelize.getQueryInterface();

    // PostgreSQL
    const tablesRes = await sequelize.query(
      `
      SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'`,
      { type: Sequelize.QueryTypes.SELECT }
    );

    // Mariadb
    // const tablesRes = await sequelize.query(
    //   `
    //   SELECT table_name
    //   FROM information_schema.tables
    //   WHERE table_schema = DATABASE()
    //   `,
    //   { type: Sequelize.QueryTypes.SELECT }
    // );

    console.log("Tables:", tablesRes);

    const schema = [];

    function parseDatatype(type) {
      if (!type) return ["UNKNOWN", ""];

      if (type.startsWith("ENUM")) {
        const matches = type.match(/ENUM\((.*)\)/);
        if (matches) {
          const values = matches[1]
            .split(",")
            .map((val) => val.trim().replace(/'/g, ""))
            .join(", ");
          return ["ENUM", values];
        }
        return ["ENUM", ""];
      }

      const matches = type.match(/^(\w+)(\((\d+)\))?/);
      if (matches) {
        return [matches[1], matches[3] || ""];
      }

      return [type, ""];
    }

    for (const row of tablesRes) {
      let tableName = Array.isArray(row.table_name)
        ? row.table_name[0]
        : row.table_name;

      if (!tableName) continue;

      const indexes = await queryInterface.showIndex(tableName);
      const indexedColumns = indexes.flatMap((index) =>
        index.fields.map((f) => f.attribute)
      );
      const uniqueColumns = indexes
        .filter((index) => index.unique)
        .flatMap((index) => index.fields.map((f) => f.attribute));

      const foreignKeys = await sequelize.query(
        `SELECT column_name FROM information_schema.key_column_usage 
         WHERE table_name = :tableName AND constraint_name IN 
         (SELECT constraint_name FROM information_schema.table_constraints 
          WHERE table_name = :tableName AND constraint_type = 'FOREIGN KEY')`,
        {
          type: Sequelize.QueryTypes.SELECT,
          replacements: { tableName: tableName },
        }
      );

      const foreignKeyColumns = foreignKeys.map((fk) => fk.column_name);

      try {
        const columns = await queryInterface.describeTable(tableName);

        console.log("Columns:", columns);
        const fields = Object.entries(columns).map(([columnName, details]) => {
          const [datatype, size] = parseDatatype(details.type || "");
          return {
            "Column Name": columnName,
            Datatype: datatype.toLowerCase(),
            ขนาด:
              datatype === "ENUM"
                ? size
                : details.special?.length
                ? details.special.join(", ")
                : size,
            "Attibute Name": "",
            "etc.": details.comment || "",
            "Default Value": details.defaultValue || "",
            PK: details.primaryKey ? "PK" : "",
            FK: foreignKeyColumns.includes(columnName) ? "FK" : "",
            INDEX: indexedColumns.includes(columnName) ? "INDEX" : "",
            NULL: details.allowNull ? "NULL" : "NOT NULL",
            UNIQUE: uniqueColumns.includes(columnName) ? "UNIQUE" : "",
            Encrypt: "",
            "Logic Encrypt": "",
          };
        });

        schema.push({ table: tableName, fields });
      } catch (err) {
        console.error(`Error describing table ${tableName}:`, err.message);
        continue;
      }
    }

    const googleAppsScriptUrl = `https://script.google.com/macros/s/${process.env.GOOGLE_SHEET_KEY}/exec`;
    const response = await axios.post(googleAppsScriptUrl, schema, {
      headers: { "Content-Type": "application/json" },
    });

    res.json({
      message: "Data sent to Google Sheet",
      googleResponse: response.data,
      schema,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
