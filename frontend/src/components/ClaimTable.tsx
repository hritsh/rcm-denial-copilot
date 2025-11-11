import { useMemo, useState } from "react";
import type { MouseEvent } from "react";
import type { ColumnDef, SortingState, PaginationState, ColumnFiltersState } from "@tanstack/react-table";
import { flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, getFilteredRowModel, useReactTable } from "@tanstack/react-table";
import type { Claim } from "../types";
import { formatCurrency } from "../utils/format";
import { getStatusClass } from "../utils/status";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Spinner } from "./Spinner";
import { cn } from "../lib/utils";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

interface ClaimTableProps {
    claims: Claim[];
    isLoading: boolean;
    error: string | null;
    translatingKey: string | null;
    translationError: string | null;
    onTranslate: (code: string, kind: "procedure" | "diagnosis", event?: MouseEvent<HTMLButtonElement>) => void;
    onSelectClaim: (claim: Claim) => void;
}

export function ClaimTable({
    claims,
    isLoading,
    error,
    translatingKey,
    translationError,
    onTranslate,
    onSelectClaim,
}: ClaimTableProps) {
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

    // derive unique status options for the filter dropdown
    const statusOptions = useMemo(() => {
        return Array.from(new Set(claims.map((c) => c.claimStatus).filter(Boolean)));
    }, [claims]);

    const columns = useMemo<ColumnDef<Claim>[]>(
        () => [
            {
                accessorKey: "claimId",
                header: ({ column }) => {
                    const sorted = column.getIsSorted();
                    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            onClick={column.getToggleSortingHandler()}
                        >
                            Claim ID
                            <Icon className="size-3.5 text-muted-foreground/80" />
                        </Button>
                    );
                },
                sortingFn: "alphanumeric",
                cell: ({ row }) => <span className="font-mono text-sm text-foreground">{row.original.claimId}</span>,
            },
            {
                accessorKey: "dateOfService",
                header: ({ column }) => {
                    const sorted = column.getIsSorted();
                    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            onClick={column.getToggleSortingHandler()}
                        >
                            Date
                            <Icon className="size-3.5 text-muted-foreground/80" />
                        </Button>
                    );
                },
                sortingFn: (rowA, rowB) => {
                    const a = Date.parse(rowA.original.dateOfService ?? "");
                    const b = Date.parse(rowB.original.dateOfService ?? "");
                    return (Number.isNaN(a) ? 0 : a) - (Number.isNaN(b) ? 0 : b);
                },
                cell: ({ row }) => <span className="text-sm text-foreground/90">{row.original.dateOfService}</span>,
            },
            {
                accessorKey: "patientId",
                header: () => (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Patient</span>
                ),
                cell: ({ row }) => <span className="text-sm text-foreground/90">{row.original.patientId}</span>,
            },
            {
                accessorKey: "insuranceType",
                header: () => (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Insurance</span>
                ),
                cell: ({ row }) => <span className="text-sm text-foreground/90">{row.original.insuranceType}</span>,
            },
            {
                accessorKey: "reasonCode",
                header: () => (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Reason</span>
                ),
                cell: ({ row }) => <span className="text-sm text-foreground/90">{row.original.reasonCode}</span>,
            },
            {
                accessorKey: "claimStatus",
                header: "Status",
                cell: ({ row }) => (
                    <Badge variant="outline" className={cn("border px-2 py-1 text-xs", getStatusClass(row.original.claimStatus))}>
                        {row.original.claimStatus}
                    </Badge>
                ),
            },
            {
                id: "procedure",
                header: () => (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Procedure</span>
                ),
                cell: ({ row }) => {
                    const claim = row.original;
                    const label = claim.procedureName;
                    const isTranslating = translatingKey === `procedure-${claim.procedureCode}`;
                    return (
                        <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm text-foreground">{claim.procedureCode}</span>
                            {label && (
                                <Badge className="w-fit border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100">
                                    {label}
                                </Badge>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-min whitespace-nowrap px-2 text-xs"
                                onClick={(event) => onTranslate(claim.procedureCode, "procedure", event)}
                                disabled={isTranslating}
                            >
                                {isTranslating && <Spinner className="mr-2" size="xs" />}
                                Translate
                            </Button>
                        </div>
                    );
                },
            },
            {
                id: "diagnosis",
                header: () => (
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Diagnosis</span>
                ),
                cell: ({ row }) => {
                    const claim = row.original;
                    const label = claim.diagnosisName;
                    const isTranslating = translatingKey === `diagnosis-${claim.diagnosisCode}`;
                    return (
                        <div className="flex flex-col gap-1">
                            <span className="font-mono text-sm text-foreground">{claim.diagnosisCode}</span>
                            {label && (
                                <Badge className="w-fit border-emerald-500/60 bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-100">
                                    {label}
                                </Badge>
                            )}
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-min whitespace-nowrap px-2 text-xs"
                                onClick={(event) => onTranslate(claim.diagnosisCode, "diagnosis", event)}
                                disabled={isTranslating}
                            >
                                {isTranslating && <Spinner className="mr-2" size="xs" />}
                                Translate
                            </Button>
                        </div>
                    );
                },
            },
            {
                accessorKey: "billedAmount",
                header: ({ column }) => {
                    const sorted = column.getIsSorted();
                    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
                    return (
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 w-full justify-start gap-2 px-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                            onClick={column.getToggleSortingHandler()}
                        >
                            Billed
                            <Icon className="size-3.5 text-muted-foreground/80" />
                        </Button>
                    );
                },
                sortingFn: (rowA, rowB) => rowA.original.billedAmount - rowB.original.billedAmount,
                cell: ({ row }) => (
                    <span className="text-sm text-foreground/90">{formatCurrency(row.original.billedAmount)}</span>
                ),
            },
            {
                accessorKey: "followUpRequired",
                header: "Follow-up",
                cell: ({ row }) => (
                    <Badge
                        variant="outline"
                        className={cn(
                            "border px-2 py-1 text-xs",
                            row.original.followUpRequired === "Yes"
                                ? "border-amber-500/40 bg-amber-500/10 text-amber-200"
                                : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                        )}
                    >
                        {row.original.followUpRequired || "—"}
                    </Badge>
                ),
            },
            {
                accessorKey: "arStatus",
                header: "AR Status",
                cell: ({ row }) => (
                    <Badge
                        variant="outline"
                        className={cn(
                            "border px-2 py-1 text-xs",
                            row.original.arStatus
                                ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                                : "border-muted-foreground/30 bg-muted/40 text-muted-foreground"
                        )}
                    >
                        {row.original.arStatus || "—"}
                    </Badge>
                ),
            }
        ],
        [onTranslate, translatingKey]
    );

    const table = useReactTable({
        data: claims,
        columns,
        state: { sorting, pagination, columnFilters },
        onSortingChange: setSorting,
        onPaginationChange: setPagination,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
    });

    return (
        <Card className="border border-border/60 bg-card/60 text-card-foreground shadow-lg">
            <CardHeader>
                <div className="flex flex-col gap-2">
                    <CardTitle className="text-xl font-semibold">Claim Explorer</CardTitle>
                    <CardDescription>Focus on denied or under-review claims to unlock quick resolutions.</CardDescription>
                </div>
                {isLoading && (
                    <div className="ml-auto flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner size="sm" />
                        <span>Loading</span>
                    </div>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {error && (
                    <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
                        {error}
                    </div>
                )}

                {/* Status filter dropdown */}
                <div className="flex items-center gap-3">
                    <div className="text-xs text-muted-foreground">Filter by status:</div>
                    <Select
                        value={(table.getColumn("claimStatus")?.getFilterValue() as string) ?? "ALL"}
                        onValueChange={(value: string) =>
                            table.getColumn("claimStatus")?.setFilterValue(value === "ALL" ? undefined : value)
                        }
                    >
                        <SelectTrigger className="h-8 w-[180px] justify-between text-xs">
                            <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All statuses</SelectItem>
                            {statusOptions.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {status}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="overflow-hidden rounded-lg border border-border/50">
                    <div className="max-h-[540px] overflow-auto">
                        <Table>
                            <TableHeader>
                                {table.getHeaderGroups().map((headerGroup) => (
                                    <TableRow key={headerGroup.id} className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                                        {headerGroup.headers.map((header) => (
                                            <TableHead key={header.id} className="min-w-[120px] whitespace-nowrap px-4 py-2">
                                                {header.isPlaceholder
                                                    ? null
                                                    : flexRender(header.column.columnDef.header, header.getContext())}
                                            </TableHead>
                                        ))}
                                    </TableRow>
                                ))}
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="h-36 text-center text-sm text-muted-foreground">
                                            <div className="flex flex-col items-center justify-center gap-3">
                                                <Spinner size="lg" />
                                                <span>Loading claims…</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ) : table.getRowModel().rows.length ? (
                                    table.getRowModel().rows.map((row) => (
                                        <TableRow
                                            key={row.id}
                                            className="cursor-pointer border-b border-border/40 bg-background/40 transition hover:bg-muted/50"
                                            onClick={() => onSelectClaim(row.original)}
                                        >
                                            {row.getVisibleCells().map((cell) => (
                                                <TableCell key={cell.id} className="min-w-[140px] align-top px-4 py-3 text-sm">
                                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                                </TableCell>
                                            ))}
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={columns.length} className="py-20 text-center text-sm text-muted-foreground">
                                            No denied or under-review claims found.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                        Page {pagination.pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.previousPage()}
                            disabled={!table.getCanPreviousPage()}
                        >
                            Previous
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => table.nextPage()}
                            disabled={!table.getCanNextPage()}
                        >
                            Next
                        </Button>
                        <Select
                            value={pagination.pageSize.toString()}
                            onValueChange={(value: string) => table.setPageSize(Number(value))}
                        >
                            <SelectTrigger className="h-8 w-[110px] justify-between text-xs">
                                <SelectValue placeholder="Rows" />
                            </SelectTrigger>
                            <SelectContent>
                                {[10, 20, 30].map((size) => (
                                    <SelectItem key={size} value={size.toString()}>
                                        {size} rows
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {translationError && (
                    <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-200">
                        {translationError}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
