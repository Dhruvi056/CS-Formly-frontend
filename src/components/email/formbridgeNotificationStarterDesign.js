/**
 * Unlayer starter design: header + form name/URL + {{AllFields}} table.
 * Matches the FormBridge notification layout (Concatstring-style header).
 */
export const formbridgeNotificationStarterDesign = {
  counters: {
    u_row: 3,
    u_column: 3,
    u_content_heading: 2,
    u_content_text: 3,
  },
  body: {
    id: "body_starter",
    rows: [
      {
        id: "row_header",
        cells: [1],
        columns: [
          {
            id: "col_header",
            contents: [
              {
                id: "hdr_brand",
                type: "heading",
                values: {
                  containerPadding: "28px 24px 8px",
                  headingType: "h1",
                  fontSize: "28px",
                  textAlign: "center",
                  lineHeight: "120%",
                  linkStyle: {
                    inherit: true,
                    linkColor: "#0000ee",
                    linkHoverColor: "#0000ee",
                    linkUnderline: true,
                    linkHoverUnderline: true,
                  },
                  text: "{{EmailLogo}}",
                },
              },
              {
                id: "hdr_sub",
                type: "text",
                values: {
                  containerPadding: "0 24px 28px",
                  textAlign: "center",
                  lineHeight: "140%",
                  text: '<p style="margin:0;font-size:12px;font-weight:600;letter-spacing:2.5px;color:#ffffff;text-transform:uppercase;">NEW SUBMISSION</p>',
                },
              },
            ],
            values: {
              backgroundColor: "#004f9d",
              padding: "0px",
              border: {},
              _meta: { htmlID: "u_column_header", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: {
            url: "",
            fullWidth: true,
            repeat: "no-repeat",
            size: "custom",
            position: "center",
          },
          padding: "0px",
          anchor: "",
          _meta: { htmlID: "u_row_header", htmlClassNames: "u_row" },
        },
      },
      {
        id: "row_form_meta",
        cells: [1],
        columns: [
          {
            id: "col_form_meta",
            contents: [
              {
                id: "form_name",
                type: "heading",
                values: {
                  containerPadding: "16px 16px 6px",
                  headingType: "h2",
                  fontSize: "20px",
                  textAlign: "left",
                  lineHeight: "120%",
                  text: "<span>{{FormName}}</span>",
                },
              },
              {
                id: "form_url",
                type: "text",
                values: {
                  containerPadding: "0 16px 16px",
                  textAlign: "left",
                  lineHeight: "140%",
                  text: '<p style="margin:0;font-size:12px;"><a href="{{DashboardUrl}}" target="_blank" style="color:#004f9d;word-break:break-all;">{{DashboardUrl}}</a></p>',
                },
              },
            ],
            values: {
              backgroundColor: "#ffffff",
              padding: "0px",
              border: {
                borderTopWidth: "1px",
                borderTopStyle: "solid",
                borderTopColor: "#e5e7eb",
                borderLeftWidth: "1px",
                borderLeftStyle: "solid",
                borderLeftColor: "#e5e7eb",
                borderRightWidth: "1px",
                borderRightStyle: "solid",
                borderRightColor: "#e5e7eb",
                borderBottomWidth: "1px",
                borderBottomStyle: "solid",
                borderBottomColor: "#e5e7eb",
              },
              _meta: { htmlID: "u_column_form", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: {
            url: "",
            fullWidth: true,
            repeat: "no-repeat",
            size: "custom",
            position: "center",
          },
          padding: "16px 0 0",
          anchor: "",
          _meta: { htmlID: "u_row_form", htmlClassNames: "u_row" },
        },
      },
      {
        id: "row_fields",
        cells: [1],
        columns: [
          {
            id: "col_fields",
            contents: [
              {
                id: "all_fields",
                type: "text",
                values: {
                  containerPadding: "16px",
                  textAlign: "left",
                  lineHeight: "140%",
                  text: "<p style=\"margin:0;\">{{AllFields}}</p>",
                },
              },
            ],
            values: {
              backgroundColor: "#ffffff",
              padding: "0px",
              border: {
                borderTopWidth: "0px",
                borderLeftWidth: "1px",
                borderLeftStyle: "solid",
                borderLeftColor: "#e5e7eb",
                borderRightWidth: "1px",
                borderRightStyle: "solid",
                borderRightColor: "#e5e7eb",
                borderBottomWidth: "1px",
                borderBottomStyle: "solid",
                borderBottomColor: "#e5e7eb",
              },
              _meta: { htmlID: "u_column_fields", htmlClassNames: "u_column" },
            },
          },
        ],
        values: {
          displayCondition: null,
          columns: false,
          backgroundColor: "",
          columnsBackgroundColor: "",
          backgroundImage: {
            url: "",
            fullWidth: true,
            repeat: "no-repeat",
            size: "custom",
            position: "center",
          },
          padding: "0 0 16px",
          anchor: "",
          _meta: { htmlID: "u_row_fields", htmlClassNames: "u_row" },
        },
      },
    ],
    headers: [],
    footers: [],
    values: {
      popupPosition: "center",
      popupWidth: "600px",
      popupHeight: "auto",
      borderRadius: "10px",
      contentAlign: "center",
      contentVerticalAlign: "center",
      contentWidth: "600px",
      fontFamily: {
        label: "Arial",
        value: "arial,helvetica,sans-serif",
      },
      preheaderText: "",
      linkStyle: {
        body: true,
        linkColor: "#004f9d",
        linkHoverColor: "#004f9d",
        linkUnderline: true,
        linkHoverUnderline: true,
      },
      backgroundColor: "#f3f4f8",
      backgroundImage: {
        url: "",
        fullWidth: true,
        repeat: "no-repeat",
        size: "custom",
        position: "center",
      },
    },
  },
  schemaVersion: 16,
};
