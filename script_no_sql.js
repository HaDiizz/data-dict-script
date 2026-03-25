import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import axios from "axios";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 7777;

app.use(express.json());

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("MongoDB connected successfully");
  } catch (error) {
    console.error("Unable to connect to MongoDB:", error);
    process.exit(1);
  }
};

connectDB();

function analyzeFieldType(value) {
  if (value === null || value === undefined) return "Mixed";
  if (typeof value === "string") return "String";
  if (typeof value === "number") {
    return Number.isInteger(value) ? "Number (Integer)" : "Number (Decimal)";
  }
  if (typeof value === "boolean") return "Boolean";
  if (value instanceof Date) return "Date";
  if (mongoose.Types.ObjectId.isValid(value)) return "ObjectId";
  if (Array.isArray(value)) {
    if (value.length === 0) return "Array (Empty)";
    const firstType = analyzeFieldType(value[0]);
    return `Array of ${firstType}`;
  }
  if (typeof value === "object") return "Object/Subdocument";
  return "Mixed";
}

function getFieldStats(values) {
  const nonNullValues = values.filter((v) => v !== null && v !== undefined);
  const totalCount = values.length;
  const nonNullCount = nonNullValues.length;
  const nullCount = totalCount - nonNullCount;

  return {
    totalCount,
    nonNullCount,
    nullCount,
    nullPercentage: ((nullCount / totalCount) * 100).toFixed(1) + "%",
  };
}

function isForeignKey(fieldName, dataType) {
  if (fieldName === "_id") return false;

  if (dataType === "ObjectId") return true;

  if (dataType === "Array of ObjectId") return true;

  return false;
}

async function analyzeCollectionSchema(collectionName, sampleSize = 100) {
  try {
    const db = mongoose.connection.db;
    const collection = db.collection(collectionName);

    const documents = await collection
      .aggregate([{ $sample: { size: sampleSize } }])
      .toArray();

    if (documents.length === 0) {
      return {
        table: `${collectionName}`,
        fields: [
          {
            "Column Name": "No documents found",
            Datatype: "N/A",
            ขนาด: "0",
            "Attibute Name": "",
            "etc.": "Collection is empty",
            "Default Value": "",
            PK: "",
            FK: "",
            INDEX: "",
            NULL: "",
            UNIQUE: "",
            Encrypt: "",
            "Logic Encrypt": "",
          },
        ],
      };
    }

    const fieldPaths = new Set();
    const fieldValues = {};

    function extractPaths(obj, prefix = "") {
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = prefix ? `${prefix}.${key}` : key;

        if (fullPath === "__v") continue;

        fieldPaths.add(fullPath);

        if (!fieldValues[fullPath]) {
          fieldValues[fullPath] = [];
        }
        fieldValues[fullPath].push(value);

        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(value instanceof Date) &&
          !mongoose.Types.ObjectId.isValid(value)
        ) {
          extractPaths(value, fullPath);
        }
      }
    }

    documents.forEach((doc) => extractPaths(doc));

    const indexes = await collection.indexes();
    const indexedFields = new Set();
    const uniqueFields = new Set();

    indexes.forEach((index) => {
      Object.keys(index.key).forEach((field) => {
        indexedFields.add(field);
        if (index.unique) {
          uniqueFields.add(field);
        }
      });
    });

    const fields = Array.from(fieldPaths).map((fieldPath) => {
      const values = fieldValues[fieldPath];
      const stats = getFieldStats(values);

      const typeCounts = {};
      values.forEach((value) => {
        const type = analyzeFieldType(value);
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      const mostCommonType =
        Object.entries(typeCounts).sort(([, a], [, b]) => b - a)[0]?.[0] ||
        "Mixed";

      let sizeInfo = "";
      if (mostCommonType.includes("Array")) {
        const arraySizes = values
          .filter((v) => Array.isArray(v))
          .map((v) => v.length);
        if (arraySizes.length > 0) {
          const avgSize = (
            arraySizes.reduce((a, b) => a + b, 0) / arraySizes.length
          ).toFixed(1);
          const maxSize = Math.max(...arraySizes);
          sizeInfo = `Avg: ${avgSize}, Max: ${maxSize}`;
        }
      } else if (mostCommonType === "String") {
        const stringLengths = values
          .filter((v) => typeof v === "string")
          .map((v) => v.length);
        if (stringLengths.length > 0) {
          const avgLength = (
            stringLengths.reduce((a, b) => a + b, 0) / stringLengths.length
          ).toFixed(1);
          const maxLength = Math.max(...stringLengths);
          sizeInfo = `Avg: ${avgLength}, Max: ${maxLength}`;
        }
      }

      let formattedSize = "";
      if (sizeInfo) {
        if (sizeInfo.includes("Avg:")) {
          const parts = sizeInfo.match(/Avg: ([\d.]+), Max: (\d+)/);
          if (parts) {
            formattedSize = `${Math.round(parseFloat(parts[1]))}/${parts[2]}`;
          }
        } else {
          formattedSize = sizeInfo;
        }
      }

      const presencePercent = (
        (stats.nonNullCount / stats.totalCount) *
        100
      ).toFixed(0);

      const fkInfo = isForeignKey(fieldPath, mostCommonType) ? "FK" : "";

      return {
        "Column Name": fieldPath,
        Datatype: mostCommonType,
        ขนาด: "",
        "Attibute Name": "",
        "etc.": "",
        "Default Value": "",
        PK: fieldPath === "_id" ? "PK" : "",
        FK: fkInfo,
        INDEX: indexedFields.has(fieldPath) ? "INDEX" : "",
        NULL: stats.nullCount > 0 ? "NULLABLE" : "NOT NULL",
        UNIQUE: uniqueFields.has(fieldPath) ? "UNIQUE" : "",
        Encrypt: "",
        "Logic Encrypt": "",
      };
    });

    return {
      table: `${collectionName}`,
      fields: fields.sort((a, b) => {
        if (a["Column Name"] === "_id") return -1;
        if (b["Column Name"] === "_id") return 1;
        return a["Column Name"].localeCompare(b["Column Name"]);
      }),
    };
  } catch (error) {
    console.error(
      `Error analyzing collection ${collectionName}:`,
      error.message
    );
    return {
      table: `${collectionName}`,
      fields: [
        {
          "Column Name": "Error",
          Datatype: "N/A",
          ขนาด: "",
          "Attibute Name": "",
          "etc.": `Error: ${error.message}`,
          "Default Value": "",
          PK: "",
          FK: "",
          INDEX: "",
          NULL: "",
          UNIQUE: "",
          Encrypt: "",
          "Logic Encrypt": "",
        },
      ],
    };
  }
}

app.get("/inspect", async (req, res) => {
  try {
    const sampleSize = parseInt(req.query.sampleSize) || 100;

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);

    console.log("Collections found:", collectionNames);

    if (collectionNames.length === 0) {
      return res.json({
        message: "No collections found in database",
        schema: [],
      });
    }

    const schema = [];

    for (const collectionName of collectionNames) {
      console.log(`Analyzing collection: ${collectionName}`);
      const collectionSchema = await analyzeCollectionSchema(
        collectionName,
        sampleSize
      );
      schema.push(collectionSchema);
    }

    const googleAppsScriptUrl = `https://script.google.com/macros/s/${process.env.GOOGLE_SHEET_KEY}/exec`;
    const response = await axios.post(googleAppsScriptUrl, schema, {
      headers: { "Content-Type": "application/json" },
    });

    res.json({
      message: "MongoDB schema analysis sent to Google Sheet",
      collectionsAnalyzed: collectionNames.length,
      sampleSize: sampleSize,
      googleResponse: response.data,
      schema,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    mongodb:
      mongoose.connection.readyState === 1 ? "Connected" : "Disconnected",
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(
    `MongoDB Schema Inspector ready at http://localhost:${PORT}/inspect`
  );
});
