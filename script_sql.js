import express from "express";
import { Sequelize } from "sequelize";
import dotenv from "dotenv";
import axios from "axios";
dotenv.config();

const app = express();
const PORT = process.env.PORT || 7777;
const DB_DIALECT = process.env.DB_DIALECT || "mariadb";
const DB_PORT = process.env.DB_PORT || (DB_DIALECT === "postgres" ? 5432 : 3306);

app.use(express.json());

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USERNAME,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: DB_DIALECT,
    port: DB_PORT,
    logging: false,
  }
);

async function runInspection(res = null) {
  try {
    const queryInterface = sequelize.getQueryInterface();

    console.log(`Starting inspection for ${DB_DIALECT}...`);

    const tableQuery =
      DB_DIALECT === "postgres"
        ? "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
        : "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()";

    const tablesRes = await sequelize.query(tableQuery, {
      type: Sequelize.QueryTypes.SELECT,
    });

    console.log("Tables found:", tablesRes.length);

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
      let tableName = row.table_name || row.TABLE_NAME || row[0] || (typeof row === 'object' ? Object.values(row)[0] : null);

      if (!tableName) continue;
      console.log(`Processing table: ${tableName}`);

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

      const foreignKeyColumns = foreignKeys.map((fk) => fk.column_name || fk.COLUMN_NAME || fk[0] || (typeof fk === 'object' ? Object.values(fk)[0] : null));

      try {
        const columns = await queryInterface.describeTable(tableName);

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
        schema.push({ table: tableName, fields: [] });
      }
    }

    console.log("Total tables processed into schema:", schema.length);

    const googleAppsScriptUrl = `https://script.google.com/macros/s/${process.env.GOOGLE_SHEET_KEY}/exec`;
    console.log("Sending data to Google Sheet...");

    const response = await axios.post(googleAppsScriptUrl, schema, {
      headers: { "Content-Type": "application/json" },
    });

    const result = {
      message: "Data sent to Google Sheet",
      googleResponse: response.data,
      tablesProcessed: schema.length,
    };

    if (res) {
      res.json({ ...result, schema });
    } else {
      console.log("Success:", result.message);
      console.log("Google Response:", result.googleResponse);
    }
  } catch (error) {
    console.error("Error during inspection:", error);
    if (res) {
      res.status(500).json({ error: error.message });
    }
  }
}

(async () => {
  try {
    await sequelize.authenticate();
    console.log(`Database connected successfully (${DB_DIALECT})`);

    if (process.env.AUTO_RUN === "true") {
      await runInspection();
    }
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
})();

app.get("/inspect", async (req, res) => {
  await runInspection(res);
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`SQL Inspector (${DB_DIALECT}) ready at http://localhost:${PORT}/inspect`);
});
