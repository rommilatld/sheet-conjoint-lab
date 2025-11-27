import React from "react";
import { displayLevel } from "../utils/displayLevel";

export const SurveyPreview = ({ attributes, projectKey }) => {
  return (
    <div className="border rounded-lg p-6 bg-white shadow">
      <h2 className="text-xl font-semibold mb-4">Survey Preview</h2>

      {attributes.length === 0 ? (
        <p>No attributes configured.</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="border p-2">Attribute</th>
              <th className="border p-2">Level</th>
            </tr>
          </thead>
          <tbody>
            {attributes.map((attr) =>
              attr.levels.map((level, idx) => (
                <tr key={attr.name + idx}>
                  <td className="border p-2">{attr.name}</td>
                  <td className="border p-2">{displayLevel(level)}</td>
                </tr>
              )),
            )}
          </tbody>
        </table>
      )}
    </div>
  );
};
