import { createFileRoute } from "@tanstack/react-router";
import { DashRecordsPage } from "@/pages/DashRecords";

export const Route = createFileRoute("/dashboard/records")({ component: DashRecordsPage });
