import type { ReactNode } from "react";
import { str, type Row } from "./api";

type Column = {
  label: string;
  render: (row: Row) => ReactNode;
  mobile?: "identity" | "full" | "omit";
};

export function Table({
  data,
  columns,
  empty = "No records yet.",
  variant,
}: {
  data: Row[];
  columns: Column[];
  empty?: string;
  variant?: "stock" | "stock-preview";
}) {
  if (!data.length)
    return (
      <div className="empty">
        <p>{empty}</p>
      </div>
    );

  return (
    <div
      className={`table-scroll records-table${variant ? ` records-${variant}` : ""}`}
      tabIndex={0}
      role="group"
      aria-label="Records"
    >
      <table role="table">
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((column) => (
              <th
                key={column.label}
                role="columnheader"
                scope="col"
                className={column.label === "Select" ? "col-select" : undefined}
                data-mobile={column.mobile}
              >
                {column.label === "Select" ? (
                  <span className="sr-only">Select</span>
                ) : (
                  column.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {data.map((row, index) => (
            <tr key={str(row, "id") || str(row, "stoneId") || index} role="row">
              {columns.map((column) => (
                <td
                  key={column.label}
                  role="cell"
                  className={
                    column.label === "Select" ? "col-select" : undefined
                  }
                  data-mobile={column.mobile}
                >
                  {column.label !== "Select" && (
                    <span className="record-field-label" aria-hidden="true">
                      {column.label}
                    </span>
                  )}
                  <div className="record-field-value">{column.render(row)}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
