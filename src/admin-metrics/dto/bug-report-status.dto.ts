import { IsIn } from "class-validator";

export class BugReportStatusDto {
	@IsIn(["OPEN", "DONE"])
	status!: "OPEN" | "DONE";
}
