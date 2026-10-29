import { app } from "./app.js";
import * as dotenv from "dotenv";
dotenv.config();
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Flatmates API backend listening on http://localhost:${PORT}`);
    console.log(`📡 Healthcheck available at http://localhost:${PORT}/api/v1/health`);
});
//# sourceMappingURL=index.js.map