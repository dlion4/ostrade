import { createFileRoute } from "@tanstack/react-router";
import { DashRecordsPage } from "@/pages/dashboard/DashRecords";

export const Route = createFileRoute("/dashboard/records")({ component: DashRecordsPage });
