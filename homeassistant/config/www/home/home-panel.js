// Home panel: whole-house overview. A dependency-free web component registered
// via panel_custom; entity ids come from panel_custom `config`. Each tile is a
// deliberately simple read of a domain; its own panel has the full detail.

const ICONS = {
  mdiCheck: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
  mdiClockOutline: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
  mdiWateringCan: "M18.5 7.47C17.76 8.2 17.57 9.25 17.92 10.15L15 13.07V11C15 10.45 14.55 10 14 10H12.97C13 9.83 13 9.67 13 9.5C13 6.46 10.54 4 7.5 4S2 6.46 2 9.5C2 11.21 2.78 12.73 4 13.74V20C4 20.55 4.45 21 5 21H14C14.55 21 15 20.55 15 20V15.89L19.33 11.56C20.23 11.91 21.28 11.73 22 11L18.5 7.47M4.05 10C4.03 9.83 4 9.67 4 9.5C4 7.57 5.57 6 7.5 6S11 7.57 11 9.5C11 9.67 10.97 9.83 10.95 10H4.05Z",
  mdiDoorbell: "M12 10C10.9 10 10 10.9 10 12S10.9 14 12 14 14 13.1 14 12 13.1 10 12 10M16 2H8C6.9 2 6 2.9 6 4V20C6 21.1 6.9 22 8 22H16C17.1 22 18 21.1 18 20V4C18 2.9 17.1 2 16 2M16 20H8V4H16V20Z",
  mdiAccessPointOff: "M20.84 22.73L12.1 14C12.06 14 12.03 14 12 14C10.9 14 10 13.11 10 12C10 11.97 10 11.94 10 11.9L8.4 10.29C8.15 10.81 8 11.38 8 12C8 13.11 8.45 14.11 9.17 14.83L7.76 16.24C6.67 15.15 6 13.65 6 12C6 10.83 6.34 9.74 6.93 8.82L5.5 7.37C4.55 8.67 4 10.27 4 12C4 14.22 4.89 16.22 6.34 17.66L4.93 19.07C3.12 17.26 2 14.76 2 12C2 9.72 2.77 7.63 4.06 5.95L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M15.93 12.73L17.53 14.33C17.83 13.61 18 12.83 18 12C18 10.35 17.33 8.85 16.24 7.76L14.83 9.17C15.55 9.89 16 10.89 16 12C16 12.25 15.97 12.5 15.93 12.73M19.03 15.83L20.5 17.28C21.44 15.75 22 13.94 22 12C22 9.24 20.88 6.74 19.07 4.93L17.66 6.34C19.11 7.78 20 9.79 20 12C20 13.39 19.65 14.7 19.03 15.83Z",
  mdiAccountArrowRight: "M18 16H14V18H18V20L21 17L18 14V16M11 4C8.8 4 7 5.8 7 8S8.8 12 11 12 15 10.2 15 8 13.2 4 11 4M11 14C6.6 14 3 15.8 3 18V20H12.5C12.2 19.2 12 18.4 12 17.5C12 16.3 12.3 15.2 12.9 14.1C12.3 14.1 11.7 14 11 14",
  mdiAlarmLight: "M6,6.9L3.87,4.78L5.28,3.37L7.4,5.5L6,6.9M13,1V4H11V1H13M20.13,4.78L18,6.9L16.6,5.5L18.72,3.37L20.13,4.78M4.5,10.5V12.5H1.5V10.5H4.5M19.5,10.5H22.5V12.5H19.5V10.5M6,20H18A2,2 0 0,1 20,22H4A2,2 0 0,1 6,20M12,5A6,6 0 0,1 18,11V19H6V11A6,6 0 0,1 12,5Z",
  mdiBatteryAlert: "M13 14H11V8H13M13 18H11V16H13M16.7 4H15V2H9V4H7.3C6.6 4 6 4.6 6 5.3V20.6C6 21.4 6.6 22 7.3 22H16.6C17.3 22 17.9 21.4 17.9 20.7V5.3C18 4.6 17.4 4 16.7 4Z",
  mdiCalendar: "M19,19H5V8H19M16,1V3H8V1H6V3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3H18V1M17,12H12V17H17V12Z",
  mdiCalendarQuestion: "M6,1V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3H18V1H16V3H8V1H6M5,8H19V19H5V8M12.19,9C11.32,9 10.62,9.2 10.08,9.59C9.56,10 9.3,10.57 9.31,11.36L9.32,11.39H11.25C11.26,11.09 11.35,10.86 11.53,10.7C11.71,10.55 11.93,10.47 12.19,10.47C12.5,10.47 12.76,10.57 12.94,10.75C13.12,10.94 13.2,11.2 13.2,11.5C13.2,11.82 13.13,12.09 12.97,12.32C12.83,12.55 12.62,12.75 12.36,12.91C11.85,13.25 11.5,13.55 11.31,13.82C11.11,14.08 11,14.5 11,15H13C13,14.69 13.04,14.44 13.13,14.26C13.22,14.08 13.39,13.9 13.64,13.74C14.09,13.5 14.46,13.21 14.75,12.81C15.04,12.41 15.19,12 15.19,11.5C15.19,10.74 14.92,10.13 14.38,9.68C13.85,9.23 13.12,9 12.19,9M11,16V18H13V16H11Z",
  mdiCalendarRemove: "M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M9.31,17L11.75,14.56L14.19,17L15.25,15.94L12.81,13.5L15.25,11.06L14.19,10L11.75,12.44L9.31,10L8.25,11.06L10.69,13.5L8.25,15.94L9.31,17Z",
  mdiCctv: "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z",
  mdiCctvOff: "M20.84 22.73L18.11 20H17C15.9 20 15 19.1 15 18V16.89L12.66 14.55L11.81 15.04C10.86 15.59 9.63 15.26 9.08 14.31L7.58 11.71C7.18 11 7.25 10.18 7.68 9.57L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L10.77 7.57L17.86 14.66C18.26 14.22 18.5 13.64 18.5 13M2 12.62L5.5 18.68L8.03 15.5L6.03 12.03L2 12.62Z",
  mdiCeilingLight: "M8,9H11V4H13V9H16L20,17H4L8,9M14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18H14Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiChevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  mdiCoachLamp: "M16 5L15 2H13L12 5L6 8H8L8.6 11H4V7H2V17H4V13H9L10 18L12 20L13 22H15L16 20L18 18L20 8H22M16.16 17H11.84L10 8H18Z",
  mdiDeskLamp: "M10.85,2L9.18,4.5L10.32,5.25L7.14,10C7.1,10 7.05,10 7,10A2,2 0 0,0 5,12C5,12.94 5.66,13.75 6.58,13.95L10.62,20H7V22H17V20H13L8.53,13.28C8.83,12.92 9,12.47 9,12C9,11.7 8.93,11.4 8.8,11.13L12,6.37C11.78,8.05 12.75,9.89 14.45,11L18.89,4.37C17.2,3.24 15.12,3.04 13.65,3.87L10.85,2M18.33,7L16.67,9.5C17.35,9.95 18.29,9.77 18.75,9.08C19.21,8.39 19,7.46 18.33,7Z",
  mdiFan: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
  mdiFloorLamp: "M15,2L17,9H7L9,2M11,10H13V20H16V22H8V20H11V10Z",
  mdiGarageVariant: "M22 9V20H20V11H4V20H2V9L12 5L22 9M19 12H5V14H19V12M19 18H5V20H19V18M19 15H5V17H19V15Z",
  mdiHarddisk: "M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A6,6 0 0,0 6,10C6,13.31 8.69,16 12.1,16L11.22,13.77C10.95,13.29 11.11,12.68 11.59,12.4L12.45,11.9C12.93,11.63 13.54,11.79 13.82,12.27L15.74,14.69C17.12,13.59 18,11.9 18,10A6,6 0 0,0 12,4M12,9A1,1 0 0,1 13,10A1,1 0 0,1 12,11A1,1 0 0,1 11,10A1,1 0 0,1 12,9M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M12.09,13.27L14.58,19.58L17.17,18.08L12.95,12.77L12.09,13.27Z",
  mdiHomeAccount: "M12,3L2,12H5V20H19V12H22L12,3M12,8.75A2.25,2.25 0 0,1 14.25,11A2.25,2.25 0 0,1 12,13.25A2.25,2.25 0 0,1 9.75,11A2.25,2.25 0 0,1 12,8.75M12,15C13.5,15 16.5,15.75 16.5,17.25V18H7.5V17.25C7.5,15.75 10.5,15 12,15Z",
  mdiLamp: "M8,2H16L20,14H4L8,2M11,15H13V20H18V22H6V20H11V15Z",
  mdiLanDisconnect: "M4,1C2.89,1 2,1.89 2,3V7C2,8.11 2.89,9 4,9H1V11H13V9H10C11.11,9 12,8.11 12,7V3C12,1.89 11.11,1 10,1H4M4,3H10V7H4V3M14,13C12.89,13 12,13.89 12,15V19C12,20.11 12.89,21 14,21H11V23H23V21H20C21.11,21 22,20.11 22,19V15C22,13.89 21.11,13 20,13H14M3.88,13.46L2.46,14.88L4.59,17L2.46,19.12L3.88,20.54L6,18.41L8.12,20.54L9.54,19.12L7.41,17L9.54,14.88L8.12,13.46L6,15.59L3.88,13.46M14,15H20V19H14V15Z",
  mdiLightRecessed: "M12 7C6.5 7 2 9.46 2 12.5S6.5 18 12 18 22 15.54 22 12.5 17.5 7 12 7M16.5 10C16.5 10.4 14.9 11.54 12 11.54S7.5 10.4 7.5 10C7.5 9.91 7.65 9.74 7.9 9.55C9.06 9.21 10.44 9 12 9S14.94 9.21 16.1 9.55C16.35 9.74 16.5 9.91 16.5 10M12 16C7.12 16 4 13.93 4 12.5C4 11.81 4.73 11 6.03 10.29C6.3 11.83 8.87 13.04 12 13.04C15.13 13.04 17.7 11.83 17.97 10.29C19.27 11 20 11.81 20 12.5C20 13.93 16.88 16 12 16Z",
  mdiLightbulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiOutdoorLamp: "M15 22H13C11.9 22 11 21.1 11 20V15H17V20C17 21.1 16.1 22 15 22M7 14H21L15 9.71V6C15 4.39 13.94 2 11 2S7 4.39 7 6C7 6.45 6.81 7 6 7H5V3H3V12H5V9H6C8.2 9 9 7.21 9 6C9 5.67 9.1 4 11 4C12.83 4 13 5.54 13 6V9.71L7 14Z",
  mdiPlayCircleOutline: "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z",
  mdiPowerSocketUs: "M8,7H10V12H8V7M4.22,2H19.78C21,2 22,3 22,4.22V19.78A2.22,2.22 0 0,1 19.78,22H4.22C3,22 2,21 2,19.78V4.22A2.22,2.22 0 0,1 4.22,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M14,7.5H16V11.5H14V7.5M10.5,16.25A1.5,1.5 0 0,1 12,14.75A1.5,1.5 0 0,1 13.5,16.25V17H10.5V16.25Z",
  mdiRouterWireless: "M20.2,5.9L21,5.1C19.6,3.7 17.8,3 16,3C14.2,3 12.4,3.7 11,5.1L11.8,5.9C13,4.8 14.5,4.2 16,4.2C17.5,4.2 19,4.8 20.2,5.9M19.3,6.7C18.4,5.8 17.2,5.3 16,5.3C14.8,5.3 13.6,5.8 12.7,6.7L13.5,7.5C14.2,6.8 15.1,6.5 16,6.5C16.9,6.5 17.8,6.8 18.5,7.5L19.3,6.7M19,13H17V9H15V13H5A2,2 0 0,0 3,15V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V15A2,2 0 0,0 19,13M8,18H6V16H8V18M11.5,18H9.5V16H11.5V18M15,18H13V16H15V18Z",
  mdiSprinklerVariant: "M10 10H14V22H10V10M7 9H9V7H7V9M4 8H6V6H4V8M4 11H6V9H4V11M1 13H3V11H1V13M1 7H3V5H1V7M1 10H3V8H1V10M18 11H20V9H18V11M21 10H23V8H21V10M21 5V7H23V5H21M21 13H23V11H21V13M15 9H17V7H15V9M18 8H20V6H18V8M10 7H10.33L11 9H13L13.67 7H14V6H10V7Z",
  mdiStringLights: "M22.56 11.39C22.36 10.59 21.82 9.85 21.05 9.44L20.63 7.74C21.11 7.58 21.57 7.41 22 7.23V5C20 6.07 16.53 7.03 12 7.03S4 6.07 2 5V7.23C2.43 7.41 2.89 7.58 3.37 7.74L2.95 9.44C2.18 9.85 1.64 10.59 1.44 11.39C.905 13.57 .385 17.31 2.92 17.93C4 18.2 6 17.89 7.27 12.82C7.46 12 7.33 11.12 6.84 10.39L7.26 8.67C8.14 8.81 9.05 8.9 10 8.96V10.74C9.35 11.33 9 12.17 9 13C9 15.24 9.39 19 12 19C13.12 19 15 18.22 15 13C15 12.17 14.65 11.33 14 10.74V8.96C14.95 8.9 15.86 8.81 16.74 8.67L17.16 10.39C16.67 11.12 16.54 12 16.73 12.82C18 17.89 20 18.2 21.08 17.93C23.61 17.31 23.09 13.57 22.56 11.39M5.81 12.47C5.81 12.47 4.74 16.84 3.28 16.5C1.82 16.12 2.9 11.75 2.9 11.75S3.26 10.29 4.71 10.65 5.81 12.47 5.81 12.47M12 17.5C10.5 17.5 10.5 13 10.5 13S10.5 11.5 12 11.5 13.5 13 13.5 13 13.5 17.5 12 17.5M20.72 16.5C19.27 16.84 18.19 12.47 18.19 12.47S17.83 11 19.29 10.65 21.1 11.75 21.1 11.75 22.18 16.12 20.72 16.5Z",
  mdiTelevisionClassic: "M8.16,3L6.75,4.41L9.34,7H4C2.89,7 2,7.89 2,9V19C2,20.11 2.89,21 4,21H20C21.11,21 22,20.11 22,19V9C22,7.89 21.11,7 20,7H14.66L17.25,4.41L15.84,3L12,6.84L8.16,3M4,9H17V19H4V9M19.5,9A1,1 0 0,1 20.5,10A1,1 0 0,1 19.5,11A1,1 0 0,1 18.5,10A1,1 0 0,1 19.5,9M19.5,12A1,1 0 0,1 20.5,13A1,1 0 0,1 19.5,14A1,1 0 0,1 18.5,13A1,1 0 0,1 19.5,12Z",
  mdiThermometer: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  mdiUmbrellaOutline: "M12,4C8.9,4 6.18,6.03 5.3,9H18.7C17.82,6.04 15.09,4 12,4M12,2A9,9 0 0,1 21,11H13V19A3,3 0 0,1 10,22A3,3 0 0,1 7,19V18H9V19A1,1 0 0,0 10,20A1,1 0 0,0 11,19V11H3A9,9 0 0,1 12,2Z",
  mdiUpdate: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  mdiWaterPercent: "M12,3.25C12,3.25 6,10 6,14C6,17.32 8.69,20 12,20A6,6 0 0,0 18,14C18,10 12,3.25 12,3.25M14.47,9.97L15.53,11.03L9.53,17.03L8.47,15.97M9.75,10A1.25,1.25 0 0,1 11,11.25A1.25,1.25 0 0,1 9.75,12.5A1.25,1.25 0 0,1 8.5,11.25A1.25,1.25 0 0,1 9.75,10M14.25,14.5A1.25,1.25 0 0,1 15.5,15.75A1.25,1.25 0 0,1 14.25,17A1.25,1.25 0 0,1 13,15.75A1.25,1.25 0 0,1 14.25,14.5Z",
  mdiWeatherCloudy: "M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z",
  mdiWeatherFog: "M3,15H13A1,1 0 0,1 14,16A1,1 0 0,1 13,17H3A1,1 0 0,1 2,16A1,1 0 0,1 3,15M16,15H21A1,1 0 0,1 22,16A1,1 0 0,1 21,17H16A1,1 0 0,1 15,16A1,1 0 0,1 16,15M1,12A5,5 0 0,1 6,7C7,4.65 9.3,3 12,3C15.43,3 18.24,5.66 18.5,9.03L19,9C21.19,9 22.97,10.76 23,13H21A2,2 0 0,0 19,11H17V10A5,5 0 0,0 12,5C9.5,5 7.45,6.82 7.06,9.19C6.73,9.07 6.37,9 6,9A3,3 0 0,0 3,12C3,12.35 3.06,12.69 3.17,13H1.1L1,12M3,19H5A1,1 0 0,1 6,20A1,1 0 0,1 5,21H3A1,1 0 0,1 2,20A1,1 0 0,1 3,19M8,19H21A1,1 0 0,1 22,20A1,1 0 0,1 21,21H8A1,1 0 0,1 7,20A1,1 0 0,1 8,19Z",
  mdiWeatherLightningRainy: "M4.5,13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.44 4,15.6 3.5,15.33V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16A1,1 0 0,1 18,15A1,1 0 0,1 19,14A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59M9.5,11H12.5L10.5,15H12.5L8.75,22L9.5,17H7L9.5,11M17.5,18.67C17.5,19.96 16.5,21 15.25,21C14,21 13,19.96 13,18.67C13,17.12 15.25,14.5 15.25,14.5C15.25,14.5 17.5,17.12 17.5,18.67Z",
  mdiWeatherNight: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z",
  mdiWeatherNightPartlyCloudy: "M22,10.28C21.74,10.3 21.5,10.31 21.26,10.31C19.32,10.31 17.39,9.57 15.91,8.09C14.25,6.44 13.5,4.19 13.72,2C13.77,1.53 13.22,1 12.71,1C12.57,1 12.44,1.04 12.32,1.12C12,1.36 11.66,1.64 11.36,1.94C9.05,4.24 8.55,7.66 9.84,10.46C8.31,11.11 7.13,12.43 6.69,14.06L6,14A4,4 0 0,0 2,18A4,4 0 0,0 6,22H19A3,3 0 0,0 22,19A3,3 0 0,0 19,16C18.42,16 17.88,16.16 17.42,16.45L17.5,15.5C17.5,15.28 17.5,15.05 17.46,14.83C19.14,14.67 20.77,13.94 22.06,12.64C22.38,12.34 22.64,12 22.88,11.68C23.27,11.13 22.65,10.28 22.04,10.28M19,18A1,1 0 0,1 20,19A1,1 0 0,1 19,20H6A2,2 0 0,1 4,18A2,2 0 0,1 6,16H8.5V15.5C8.5,13.94 9.53,12.64 10.94,12.18C11.1,12.13 11.26,12.09 11.43,12.06C11.61,12.03 11.8,12 12,12C12.23,12 12.45,12.03 12.66,12.07C12.73,12.08 12.8,12.1 12.87,12.13C13,12.16 13.15,12.2 13.28,12.25C13.36,12.28 13.44,12.32 13.5,12.36C13.63,12.41 13.74,12.47 13.84,12.54C13.92,12.59 14,12.64 14.07,12.7C14.17,12.77 14.25,12.84 14.34,12.92C14.41,13 14.5,13.05 14.55,13.12C14.63,13.2 14.69,13.29 14.76,13.37C14.82,13.45 14.89,13.53 14.94,13.62C15,13.71 15.04,13.8 15.09,13.9C15.14,14 15.2,14.08 15.24,14.18C15.41,14.59 15.5,15.03 15.5,15.5V18M16.83,12.86C15.9,11.16 14.08,10 12,10H11.87C11.41,9.19 11.14,8.26 11.14,7.29C11.14,6.31 11.39,5.37 11.86,4.55C12.21,6.41 13.12,8.14 14.5,9.5C15.86,10.88 17.58,11.79 19.45,12.14C18.66,12.6 17.76,12.84 16.83,12.86Z",
  mdiWeatherPartlyCloudy: "M12.74,5.47C15.1,6.5 16.35,9.03 15.92,11.46C17.19,12.56 18,14.19 18,16V16.17C18.31,16.06 18.65,16 19,16A3,3 0 0,1 22,19A3,3 0 0,1 19,22H6A4,4 0 0,1 2,18A4,4 0 0,1 6,14H6.27C5,12.45 4.6,10.24 5.5,8.26C6.72,5.5 9.97,4.24 12.74,5.47M11.93,7.3C10.16,6.5 8.09,7.31 7.31,9.07C6.85,10.09 6.93,11.22 7.41,12.13C8.5,10.83 10.16,10 12,10C12.7,10 13.38,10.12 14,10.34C13.94,9.06 13.18,7.86 11.93,7.3M13.55,3.64C13,3.4 12.45,3.23 11.88,3.12L14.37,1.82L15.27,4.71C14.76,4.29 14.19,3.93 13.55,3.64M6.09,4.44C5.6,4.79 5.17,5.19 4.8,5.63L4.91,2.82L7.87,3.5C7.25,3.71 6.65,4.03 6.09,4.44M18,9.71C17.91,9.12 17.78,8.55 17.59,8L19.97,9.5L17.92,11.73C18.03,11.08 18.05,10.4 18,9.71M3.04,11.3C3.11,11.9 3.24,12.47 3.43,13L1.06,11.5L3.1,9.28C3,9.93 2.97,10.61 3.04,11.3M19,18H16V16A4,4 0 0,0 12,12A4,4 0 0,0 8,16H6A2,2 0 0,0 4,18A2,2 0 0,0 6,20H19A1,1 0 0,0 20,19A1,1 0 0,0 19,18Z",
  mdiWeatherPouring: "M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z",
  mdiWeatherRainy: "M6,14.03A1,1 0 0,1 7,15.03C7,15.58 6.55,16.03 6,16.03C3.24,16.03 1,13.79 1,11.03C1,8.27 3.24,6.03 6,6.03C7,3.68 9.3,2.03 12,2.03C15.43,2.03 18.24,4.69 18.5,8.06L19,8.03A4,4 0 0,1 23,12.03C23,14.23 21.21,16.03 19,16.03H18C17.45,16.03 17,15.58 17,15.03C17,14.47 17.45,14.03 18,14.03H19A2,2 0 0,0 21,12.03A2,2 0 0,0 19,10.03H17V9.03C17,6.27 14.76,4.03 12,4.03C9.5,4.03 7.45,5.84 7.06,8.21C6.73,8.09 6.37,8.03 6,8.03A3,3 0 0,0 3,11.03A3,3 0 0,0 6,14.03M12,14.15C12.18,14.39 12.37,14.66 12.56,14.94C13,15.56 14,17.03 14,18C14,19.11 13.1,20 12,20A2,2 0 0,1 10,18C10,17.03 11,15.56 11.44,14.94C11.63,14.66 11.82,14.4 12,14.15M12,11.03L11.5,11.59C11.5,11.59 10.65,12.55 9.79,13.81C8.93,15.06 8,16.56 8,18A4,4 0 0,0 12,22A4,4 0 0,0 16,18C16,16.56 15.07,15.06 14.21,13.81C13.35,12.55 12.5,11.59 12.5,11.59",
  mdiWeatherSnowy: "M6,14A1,1 0 0,1 7,15A1,1 0 0,1 6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14M7.88,18.07L10.07,17.5L8.46,15.88C8.07,15.5 8.07,14.86 8.46,14.46C8.85,14.07 9.5,14.07 9.88,14.46L11.5,16.07L12.07,13.88C12.21,13.34 12.76,13.03 13.29,13.17C13.83,13.31 14.14,13.86 14,14.4L13.41,16.59L15.6,16C16.14,15.86 16.69,16.17 16.83,16.71C16.97,17.24 16.66,17.79 16.12,17.93L13.93,18.5L15.54,20.12C15.93,20.5 15.93,21.15 15.54,21.54C15.15,21.93 14.5,21.93 14.12,21.54L12.5,19.93L11.93,22.12C11.79,22.66 11.24,22.97 10.71,22.83C10.17,22.69 9.86,22.14 10,21.6L10.59,19.41L8.4,20C7.86,20.14 7.31,19.83 7.17,19.29C7.03,18.76 7.34,18.21 7.88,18.07Z",
  mdiWeatherSunny: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  mdiWeatherSunset: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M5,16H19A1,1 0 0,1 20,17A1,1 0 0,1 19,18H5A1,1 0 0,1 4,17A1,1 0 0,1 5,16M17,20A1,1 0 0,1 18,21A1,1 0 0,1 17,22H7A1,1 0 0,1 6,21A1,1 0 0,1 7,20H17M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7Z",
  mdiWeatherSunsetDown: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12.71,20.71L15.82,17.6C16.21,17.21 16.21,16.57 15.82,16.18C15.43,15.79 14.8,15.79 14.41,16.18L12,18.59L9.59,16.18C9.2,15.79 8.57,15.79 8.18,16.18C7.79,16.57 7.79,17.21 8.18,17.6L11.29,20.71C11.5,20.9 11.74,21 12,21C12.26,21 12.5,20.9 12.71,20.71Z",
  mdiWeatherSunsetUp: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M12.71,16.3L15.82,19.41C16.21,19.8 16.21,20.43 15.82,20.82C15.43,21.21 14.8,21.21 14.41,20.82L12,18.41L9.59,20.82C9.2,21.21 8.57,21.21 8.18,20.82C7.79,20.43 7.79,19.8 8.18,19.41L11.29,16.3C11.5,16.1 11.74,16 12,16C12.26,16 12.5,16.1 12.71,16.3Z",
  mdiWeatherWindy: "M4,10A1,1 0 0,1 3,9A1,1 0 0,1 4,8H12A2,2 0 0,0 14,6A2,2 0 0,0 12,4C11.45,4 10.95,4.22 10.59,4.59C10.2,5 9.56,5 9.17,4.59C8.78,4.2 8.78,3.56 9.17,3.17C9.9,2.45 10.9,2 12,2A4,4 0 0,1 16,6A4,4 0 0,1 12,10H4M19,12A1,1 0 0,0 20,11A1,1 0 0,0 19,10C18.72,10 18.47,10.11 18.29,10.29C17.9,10.68 17.27,10.68 16.88,10.29C16.5,9.9 16.5,9.27 16.88,8.88C17.42,8.34 18.17,8 19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14H5A1,1 0 0,1 4,13A1,1 0 0,1 5,12H19M18,18H4A1,1 0 0,1 3,17A1,1 0 0,1 4,16H18A3,3 0 0,1 21,19A3,3 0 0,1 18,22C17.17,22 16.42,21.66 15.88,21.12C15.5,20.73 15.5,20.1 15.88,19.71C16.27,19.32 16.9,19.32 17.29,19.71C17.47,19.89 17.72,20 18,20A1,1 0 0,0 19,19A1,1 0 0,0 18,18Z",
  mdiWebOff: "M9.4 4.44C9.19 4.83 9 5.23 8.84 5.64L10.37 7.17C10.78 6.05 11.33 5 12 4.03C12.83 5.23 13.5 6.57 13.91 8H11.2L13.2 10H14.34C14.4 10.41 14.44 10.84 14.47 11.27L16.44 13.24C16.47 12.83 16.5 12.42 16.5 12C16.5 11.32 16.44 10.66 16.36 10H19.74C19.9 10.64 20 11.31 20 12S19.9 13.36 19.74 14H17.2L20.5 17.28C21.44 15.75 22 13.94 22 12C22 6.5 17.5 2 12 2C10.06 2 8.25 2.56 6.72 3.5L8.18 5C8.57 4.77 9 4.58 9.4 4.44M18.92 8H15.97C15.65 6.75 15.19 5.55 14.59 4.44C16.43 5.07 17.96 6.34 18.92 8M2.39 1.73L1.11 3L4.06 5.95C2.77 7.63 2 9.73 2 12C2 17.5 6.5 22 12 22C14.28 22 16.37 21.23 18.06 19.95L20.84 22.73L22.11 21.46L2.39 1.73M5.5 7.37L6.11 8H5.08C5.2 7.78 5.34 7.58 5.5 7.37M4.26 14C4.1 13.36 4 12.69 4 12S4.1 10.64 4.26 10H7.64C7.56 10.66 7.5 11.32 7.5 12S7.56 13.34 7.64 14H4.26M5.08 16H8C8.35 17.25 8.8 18.45 9.4 19.56C7.57 18.93 6.03 17.65 5.08 16M9.5 12C9.5 11.8 9.5 11.61 9.53 11.42L12.11 14H9.66C9.56 13.34 9.5 12.68 9.5 12M12 19.96C11.17 18.76 10.5 17.43 10.09 16H13.91C13.5 17.43 12.83 18.76 12 19.96M14.59 19.56C14.96 18.88 15.26 18.15 15.5 17.41L16.62 18.5C16 18.95 15.32 19.31 14.59 19.56Z",
};

const ALARM_SOUNDS = ["fire_alarm", "scream", "yell"];
const RING_NOW_MS = 3 * 60e3;
const LONG_OFFLINE_MS = 7 * 864e5;
const WEATHER_REFRESH_MS = 30 * 60e3;
const HISTORY_REFRESH_MS = 5 * 60e3;
const CALENDAR_REFRESH_MS = 15 * 60e3;
// Icons a lights/switches entry may name in config (anything else falls back to a bulb).
const SWITCH_ICONS = ["mdiLightbulb", "mdiLamp", "mdiFloorLamp", "mdiDeskLamp", "mdiCeilingLight", "mdiLightRecessed", "mdiCoachLamp", "mdiOutdoorLamp", "mdiGarageVariant", "mdiStringLights", "mdiFan", "mdiPowerSocketUs"];

const svg = (name, cls = "") => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
// A light that reports any color mode beyond plain on/off can be dimmed.
const dimmable = (st) => (st?.attributes?.supported_color_modes || []).some((m) => m !== "onoff");
// HA brightness is 0–255; show it as 1–100 % while on (a lit bulb is never "0 %").
const brightPct = (st) => (st?.state === "on" ? Math.max(1, Math.round(((st.attributes.brightness ?? 255) / 255) * 100)) : 0);
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const nice = (s) => String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);

function dayLabel(ms) {
  const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return new Date(ms).toLocaleDateString([], { weekday: "long" });
  return new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

// WMO weather codes (Open-Meteo) -> label + day/night icon.
function wmo(code, isDay = true) {
  const c = Number(code);
  if (c === 0) return isDay ? ["Clear", "mdiWeatherSunny"] : ["Clear", "mdiWeatherNight"];
  if (c === 1) return isDay ? ["Mostly clear", "mdiWeatherPartlyCloudy"] : ["Mostly clear", "mdiWeatherNightPartlyCloudy"];
  if (c === 2) return isDay ? ["Partly cloudy", "mdiWeatherPartlyCloudy"] : ["Partly cloudy", "mdiWeatherNightPartlyCloudy"];
  if (c === 3) return ["Overcast", "mdiWeatherCloudy"];
  if (c === 45 || c === 48) return ["Fog", "mdiWeatherFog"];
  if (c >= 51 && c <= 57) return ["Drizzle", "mdiWeatherRainy"];
  if (c === 65 || c === 82) return ["Heavy rain", "mdiWeatherPouring"];
  if ((c >= 61 && c <= 67) || (c >= 80 && c <= 81)) return ["Rain", "mdiWeatherRainy"];
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return ["Snow", "mdiWeatherSnowy"];
  if (c >= 95) return ["Thunderstorms", "mdiWeatherLightningRainy"];
  return ["—", "mdiWeatherPartlyCloudy"];
}

// HA weather-entity conditions, used only when Open-Meteo can't be reached directly.
const HA_CONDITION = {
  "clear-night": ["Clear", "mdiWeatherNight"], cloudy: ["Cloudy", "mdiWeatherCloudy"], fog: ["Fog", "mdiWeatherFog"],
  lightning: ["Storms", "mdiWeatherLightningRainy"], "lightning-rainy": ["Storms", "mdiWeatherLightningRainy"],
  partlycloudy: ["Partly cloudy", "mdiWeatherPartlyCloudy"], pouring: ["Heavy rain", "mdiWeatherPouring"], rainy: ["Rain", "mdiWeatherRainy"],
  snowy: ["Snow", "mdiWeatherSnowy"], "snowy-rainy": ["Sleet", "mdiWeatherSnowy"], sunny: ["Sunny", "mdiWeatherSunny"], windy: ["Windy", "mdiWeatherCloudy"],
};

function linePath(points, w, h, lo, hi, pad = 6) {
  const t0 = points[0][0];
  const t1 = points[points.length - 1][0];
  const span = hi - lo || 1;
  return points
    .map(([t, v], i) => {
      const x = ((t - t0) / Math.max(1, t1 - t0)) * w;
      const y = pad + (1 - (v - lo) / span) * (h - pad * 2);
      return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join("");
}

// Keep charts light: at most ~n evenly spaced samples, always keeping the last.
function thin(points, n = 240) {
  if (points.length <= n) return points;
  const step = points.length / n;
  const out = [];
  for (let i = 0; i < points.length; i += step) out.push(points[Math.floor(i)]);
  out.push(points[points.length - 1]);
  return out;
}

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --gold: #fcd34d; --gold-2: #d97706; --sky: #7dd3fc; --rain: #4cc3ff;
  --green: #22c55e; --amber: #f5b041; --red: #f0616d; --blue: #4cc3ff; --grey: #64748b;
  display: block; height: 100%; overflow-y: auto; container-type: inline-size;
  background: radial-gradient(1200px 600px at 10% -10%, rgba(217,119,6,.12), transparent 60%),
              radial-gradient(900px 500px at 110% 110%, rgba(40,110,190,.10), transparent 60%), var(--bg);
  color: var(--text); font-family: "Outfit", "SF Pro Display", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
}
* { box-sizing: border-box; }
button { font: inherit; color: inherit; border: 0; background: none; cursor: pointer; -webkit-tap-highlight-color: transparent; text-align: left; }
button:disabled { cursor: default; }
.ic { width: 24px; height: 24px; fill: currentColor; flex: none; }
.muted { color: var(--muted); }
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; display: grid; gap: 22px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  grid-template-areas: "head head" "lights lights" "weather weather" "tiles tiles" "trees outdoor" "climate climate" "agenda attn"; }
.app.urgent { grid-template-areas: "head head" "attn attn" "lights lights" "weather weather" "tiles tiles" "trees outdoor" "climate climate" "agenda agenda"; }
.a-head { grid-area: head; } .a-lights { grid-area: lights; } .a-weather { grid-area: weather; } .a-tiles { grid-area: tiles; }
.a-climate { grid-area: climate; } .a-agenda { grid-area: agenda; } .a-attn { grid-area: attn; }
.a-trees { grid-area: trees; } .a-outdoor { grid-area: outdoor; }

.top { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }
.hello { flex: 1 1 320px; min-width: 0; }
.hello .date { font-size: 15px; color: var(--muted); }
h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 18px; flex-wrap: wrap; }
.status b { font-weight: 600; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); animation: pulse 1.2s ease-in-out infinite; }
.dot.blue { background: var(--blue); box-shadow: 0 0 10px var(--blue); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 10px; font-size: 14px; font-weight: 500; background: #172234; border: 1px solid var(--line); color: #c3cedd; }
.chip .ic { width: 17px; height: 17px; }

.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 28px; padding: 22px 24px; min-width: 0; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; }

/* Lights */
.switches { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.sw { border-radius: 18px; padding: 14px; background: #121a28; border: 1.5px solid var(--line); display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 104px; transition: background .2s, border-color .2s; }
.sw .sic { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: #243246; color: #aeb9c9; }
.sw.on { background: #231d10; border-color: rgba(252,211,77,.45); }
.sw.on .sic { background: linear-gradient(160deg, #fde68a, var(--gold-2)); color: #3b2604; box-shadow: 0 6px 18px rgba(217,119,6,.35); }
.sw b { font-size: 16px; font-weight: 600; display: block; overflow-wrap: anywhere; }
.sw span { font-size: 13px; color: var(--muted); }
.sw.on span { color: #f7d49a; }
.sw:disabled, .sw.na { opacity: .45; }
.sw.dim { padding: 0; gap: 0; }
.sw-tap { display: flex; flex-direction: column; gap: 12px; flex: 1; min-width: 0; padding: 14px 14px 10px; border-radius: inherit; }
.dimmer { -webkit-appearance: none; appearance: none; display: block; margin: 0 14px 14px; height: 30px; border-radius: 10px; cursor: pointer; touch-action: pan-y;
  background: linear-gradient(90deg, #f5c451 var(--pct), #243246 var(--pct)); }
.dimmer:disabled { cursor: default; }
.dimmer:focus-visible, .sw-tap:focus-visible { outline: 2px solid var(--gold); outline-offset: 2px; }
.dimmer::-webkit-slider-thumb { -webkit-appearance: none; width: 6px; height: 22px; border-radius: 3px; background: #fff; box-shadow: 0 0 0 2px rgba(8,13,23,.35); }
.dimmer::-moz-range-thumb { width: 6px; height: 22px; border: 0; border-radius: 3px; background: #fff; box-shadow: 0 0 0 2px rgba(8,13,23,.35); }

/* Weather */
.a-weather { padding: 0; overflow: hidden; display: grid; grid-template-columns: minmax(0, 1.55fr) minmax(0, 1fr);
  background: radial-gradient(700px 300px at 0% 0%, rgba(56,130,200,.22), transparent 70%), linear-gradient(180deg, #13203a, var(--card)); }
.wx-main { padding: 24px 26px; min-width: 0; }
.wx-now { display: flex; align-items: center; gap: 18px; flex-wrap: wrap; }
.wx-now > .ic { width: 84px; height: 84px; color: var(--gold); filter: drop-shadow(0 6px 18px rgba(252,211,77,.25)); }
.wx-now > .ic.night { color: #c7d2fe; filter: drop-shadow(0 6px 18px rgba(199,210,254,.2)); }
.wx-temp { font-size: 76px; font-weight: 700; letter-spacing: -.03em; line-height: .95; }
.wx-cond { font-size: 22px; font-weight: 500; }
.wx-hl { font-size: 16px; color: #c3cedd; margin-top: 2px; }
.wx-facts { display: flex; flex-wrap: wrap; gap: 8px 20px; margin-top: 16px; font-size: 14.5px; color: #c3cedd; }
.wx-facts span { display: inline-flex; align-items: center; gap: 6px; }
.wx-facts .ic { width: 18px; height: 18px; color: var(--muted); }
.hourly { margin-top: 22px; }
.hourly svg { display: block; width: 100%; height: 150px; overflow: visible; }
.hourly .tline { fill: none; stroke: var(--gold); stroke-width: 2.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.hourly .tarea { fill: url(#tfill); }
.hourly .pbar { fill: rgba(76,195,255,.55); }
.hours { display: grid; grid-template-columns: repeat(9, minmax(0, 1fr)); margin-top: 6px; text-align: center; font-size: 13px; color: var(--muted); }
.hours div { display: flex; flex-direction: column; align-items: center; gap: 2px; }
.hours b { color: var(--text); font-size: 15px; font-weight: 600; }
.hours .ic { width: 20px; height: 20px; color: #c3cedd; }
.hours .pp { color: var(--rain); font-size: 12px; min-height: 15px; }
.hint { font-size: 12.5px; color: var(--muted); margin-top: 4px; display: flex; gap: 14px; flex-wrap: wrap; }
.hint i { display: inline-block; width: 12px; height: 8px; border-radius: 2px; margin-right: 6px; vertical-align: 0; }
.wx-days { padding: 18px 22px; background: rgba(8,13,23,.35); border-left: 1px solid var(--line); min-width: 0; }
.day { display: grid; grid-template-columns: 74px 26px 40px minmax(0, 1fr); align-items: center; gap: 10px; padding: 7px 0; font-size: 15px; }
.day + .day { border-top: 1px solid rgba(148,170,200,.07); }
.day .dn { font-weight: 600; }
.day .ic { width: 22px; height: 22px; color: #c3cedd; }
.day .pp { color: var(--rain); font-size: 13px; text-align: right; }
.range { display: grid; grid-template-columns: 34px minmax(0, 1fr) 34px; gap: 8px; align-items: center; font-variant-numeric: tabular-nums; }
.range .lo { color: var(--muted); text-align: right; }
.range .hi { font-weight: 600; }
.track { position: relative; height: 6px; border-radius: 3px; background: #1d2a40; }
.track i { position: absolute; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg, #60a5fa, #fcd34d, #fb923c); }
.wx-src { font-size: 12px; color: var(--muted); margin-top: 10px; }

/* Tiles */
.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
.tile { border-radius: 22px; padding: 16px 16px 14px; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1.5px solid var(--line); min-width: 0; display: flex; flex-direction: column; gap: 10px; min-height: 120px; }
.tile:hover { border-color: rgba(148,170,200,.28); }
.tile.red { border-color: rgba(240,97,109,.6); background: linear-gradient(180deg, #2a1820, var(--card)); }
.tile.amber { border-color: rgba(245,176,65,.45); }
.tile.blue { border-color: rgba(76,195,255,.45); }
.tile-top { display: flex; align-items: center; gap: 10px; }
.tic { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; color: #fff; background: #243246; flex: none; }
.tic .ic { width: 22px; height: 22px; }
.tile.green .tic { background: linear-gradient(160deg, #6ee7a8, #15803d); }
.tile.amber .tic { background: linear-gradient(160deg, #fcd58a, #d98b16); }
.tile.red .tic { background: linear-gradient(160deg, #ff9aa2, #d9434f); }
.tile.blue .tic { background: linear-gradient(160deg, #86dcff, #1d8fe8); }
.tile-name { font-size: 14px; color: var(--muted); flex: 1; }
.go { width: 18px; height: 18px; color: #4b5a70; }
.tile-state { font-size: 20px; font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }
.tile-sub { font-size: 14px; color: var(--muted); line-height: 1.35; overflow-wrap: anywhere; margin-top: -4px; }

/* Climate trends */
.a-climate { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 22px; }
.room .now { display: flex; align-items: baseline; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
.room .now b { font-size: 40px; font-weight: 700; letter-spacing: -.02em; }
.room .now span { font-size: 15px; color: #c3cedd; }
.delta { font-size: 13.5px; color: var(--muted); }
.room.stale .now b { color: var(--muted); }
.room .now .stale-note { color: #f5b14c; }
.trend { margin-top: 12px; }
.trend svg { display: block; width: 100%; height: 120px; overflow: visible; }
.trend .l-temp { fill: none; stroke: var(--gold); stroke-width: 2.5; vector-effect: non-scaling-stroke; stroke-linejoin: round; }
.trend .a-temp { fill: rgba(252,211,77,.10); }
.trend .l-hum { fill: none; stroke: var(--sky); stroke-width: 1.8; vector-effect: non-scaling-stroke; stroke-dasharray: 4 3; }
.trend .grid-l { stroke: rgba(148,170,200,.10); stroke-width: 1; vector-effect: non-scaling-stroke; }
.axis { display: flex; justify-content: space-between; font-size: 12px; color: var(--muted); margin-top: 6px; gap: 8px; }
.legend { display: flex; gap: 14px; font-size: 12.5px; color: var(--muted); margin-top: 8px; flex-wrap: wrap; }
.legend i { display: inline-block; width: 14px; height: 3px; border-radius: 2px; vertical-align: middle; margin-right: 6px; }
.seg { display: inline-flex; background: #172234; border: 1px solid var(--line); border-radius: 12px; padding: 3px; }
.seg button { padding: 5px 12px; border-radius: 9px; font-size: 13.5px; color: var(--muted); }
.seg button.on { background: #24324a; color: var(--text); font-weight: 600; }
.empty { margin-top: 12px; padding: 18px; border-radius: 14px; border: 1px dashed var(--line); color: var(--muted); font-size: 14.5px; text-align: center; }

/* Trees */
.verdict { display: flex; align-items: center; gap: 14px; margin-top: 12px; }
.verdict .vic { width: 52px; height: 52px; border-radius: 16px; display: grid; place-items: center; flex: none; background: #243246; color: #c3cedd; }
.verdict .vic .ic { width: 28px; height: 28px; }
.verdict.water .vic { background: linear-gradient(160deg, #86dcff, #1d8fe8); color: #fff; box-shadow: 0 8px 22px rgba(29,143,232,.35); }
.verdict.final .vic { background: linear-gradient(160deg, #fcd58a, #d98b16); color: #3b2604; box-shadow: 0 8px 22px rgba(217,139,22,.35); }
.verdict.skip .vic { background: linear-gradient(160deg, #6ee7a8, #15803d); color: #fff; }
.verdict b { font-size: 26px; font-weight: 700; display: block; line-height: 1.1; }
.verdict span { font-size: 14px; color: var(--muted); }
.why2 { margin-top: 12px; font-size: 16px; line-height: 1.45; color: #dbe3ee; }
.do { margin-top: 10px; display: grid; gap: 6px; font-size: 14.5px; color: #c3cedd; }
.do div { display: flex; gap: 8px; align-items: flex-start; }
.do .ic { width: 18px; height: 18px; color: var(--sky); margin-top: 1px; }
.facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; margin-top: 14px; }
.fact { border-radius: 14px; background: #121a28; border: 1px solid var(--line); padding: 10px 12px; min-width: 0; }
.fact b { display: block; font-size: 17px; font-weight: 600; overflow-wrap: anywhere; }
.fact span { font-size: 12.5px; color: var(--muted); }
.trees-foot { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 14px; flex-wrap: wrap; font-size: 14px; color: var(--muted); }
.btn { height: 42px; padding: 0 16px; border-radius: 14px; background: linear-gradient(180deg, #3fb6ff, #1b82e0); color: #fff; font-weight: 600; font-size: 15px; display: inline-flex; align-items: center; gap: 8px; }
.btn .ic { width: 20px; height: 20px; }
.btn:disabled { background: #243044; color: #6f7d92; }

/* Outdoor */
.score-row { display: flex; align-items: center; gap: 18px; margin-top: 12px; flex-wrap: wrap; }
.ring2 { position: relative; width: 112px; height: 112px; flex: none; }
.ring2 svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring2 .tr { fill: none; stroke: #1d2a40; stroke-width: 10; }
.ring2 .pr { fill: none; stroke-width: 10; stroke-linecap: round; }
.ring2 .c { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
.ring2 .c b { font-size: 34px; font-weight: 700; line-height: 1; display: block; }
.ring2 .c span { font-size: 11.5px; color: var(--muted); }
.lvl { font-size: 22px; font-weight: 700; }
.lvl.green { color: var(--green); } .lvl.yellow { color: var(--amber); } .lvl.red { color: var(--red); }
.comp { display: grid; gap: 4px; font-size: 14px; color: #c3cedd; margin-top: 4px; }
.timeline { margin-top: 14px; }
.timeline svg { display: block; width: 100%; height: 130px; overflow: visible; }
.timeline .l-score { fill: none; stroke: var(--green); stroke-width: 2.5; vector-effect: non-scaling-stroke; }
.timeline .l-aqi { fill: none; stroke: #c084fc; stroke-width: 1.8; vector-effect: non-scaling-stroke; stroke-dasharray: 4 3; }
.timeline .band { opacity: .07; }
.timeline .wl { stroke: rgba(252,211,77,.55); stroke-width: 1; vector-effect: non-scaling-stroke; }
.timeline .wd { fill: var(--gold); }
.wild { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.wild span { font-size: 12.5px; padding: 3px 8px; border-radius: 8px; background: rgba(252,211,77,.1); color: #f7d49a; border: 1px solid rgba(252,211,77,.25); }

/* Agenda */
.agenda { margin-top: 4px; display: flex; flex-direction: column; }
.agday { font-size: 12.5px; letter-spacing: .1em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 14px 0 2px; }
.ag { display: grid; grid-template-columns: 38px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 9px 0; border-top: 1px solid var(--line); width: 100%; }
.agday + .ag { border-top: 0; }
.ag .aic { width: 38px; height: 38px; border-radius: 12px; display: grid; place-items: center; background: #172234; color: #c3cedd; }
.ag .aic.cal { background: rgba(125,211,252,.12); color: var(--sky); }
.ag .aic .ic { width: 20px; height: 20px; }
.ag b { font-size: 15.5px; font-weight: 500; display: block; overflow-wrap: anywhere; }
.ag small { font-size: 13px; color: var(--muted); }
.ag .when { text-align: right; font-size: 14px; font-weight: 600; white-space: nowrap; font-variant-numeric: tabular-nums; }

/* Attention */
.items { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 16px; background: #121a28; border: 1px solid var(--line); line-height: 1.4; width: 100%; }
.item > .ic { width: 22px; height: 22px; margin-top: 1px; }
.item b { font-weight: 600; display: block; font-size: 16px; }
.item span { font-size: 14px; color: var(--muted); }
.item.red { border-color: rgba(240,97,109,.4); } .item.red > .ic { color: var(--red); }
.item.amber { border-color: rgba(245,176,65,.3); } .item.amber > .ic { color: var(--amber); }
.item.info > .ic { color: var(--blue); }
.item .go { margin-left: auto; align-self: center; }
.allgood { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 16px; color: #b9f2cc; }
.allgood .ic { color: var(--green); }
.link { margin-top: 10px; color: var(--gold); font-weight: 600; font-size: 15px; }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }
.toast.ok { background: #16322a; border-color: rgba(76,201,140,.5); color: #c9f2dc; }

@container (max-width: 1150px) {
  .switches { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .a-weather { grid-template-columns: minmax(0, 1fr); }
  .wx-days { border-left: 0; border-top: 1px solid var(--line); }
  .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@container (max-width: 900px) {
  .app, .app.urgent { grid-template-columns: minmax(0, 1fr); }
  .app { grid-template-areas: "head" "lights" "weather" "trees" "outdoor" "tiles" "climate" "agenda" "attn"; }
  .app.urgent { grid-template-areas: "head" "attn" "lights" "weather" "trees" "outdoor" "tiles" "climate" "agenda"; }
  .a-climate { grid-template-columns: minmax(0, 1fr); gap: 14px; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; gap: 14px; }
  .facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .verdict b { font-size: 22px; }
  .ring2 { width: 96px; height: 96px; } .ring2 .c b { font-size: 28px; }
  .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  h1 { font-size: 24px; } .status { font-size: 15px; margin-top: 6px; }
  .card { border-radius: 22px; padding: 16px 14px; }
  .switches { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .sw { padding: 12px; min-height: 92px; border-radius: 16px; }
  .sw-tap { padding: 12px 12px 8px; }
  .dimmer { margin: 0 12px 12px; height: 34px; }
  .sw b { font-size: 15px; }
  .wx-main { padding: 18px 16px; }
  .wx-now { gap: 12px; }
  .wx-now > .ic { width: 58px; height: 58px; }
  .wx-temp { font-size: 54px; } .wx-cond { font-size: 18px; } .wx-hl { font-size: 14px; }
  .wx-facts { font-size: 13.5px; gap: 6px 14px; }
  .hourly svg { height: 120px; }
  .hours { grid-template-columns: repeat(7, minmax(0, 1fr)); font-size: 12px; }
  .hours > div:nth-child(n+8) { display: none; }
  .hours b { font-size: 14px; }
  .wx-days { padding: 12px 16px; }
  .day { grid-template-columns: 54px 22px 34px minmax(0, 1fr); gap: 8px; font-size: 14px; }
  .range { grid-template-columns: 30px minmax(0, 1fr) 30px; gap: 6px; }
  .tiles { gap: 10px; }
  .tile { padding: 12px; border-radius: 18px; min-height: 104px; gap: 8px; }
  .tic { width: 34px; height: 34px; border-radius: 11px; } .tic .ic { width: 19px; height: 19px; }
  .tile-name { font-size: 12.5px; } .tile-state { font-size: 16px; } .tile-sub { font-size: 12.5px; }
  .room .now b { font-size: 32px; }
  .trend svg { height: 100px; }
}
`;

class HomePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._haForecast = null;
    this._wx = null;
    this._wxAt = 0;
    this._hist = {};
    this._range = "24h";
    this._events = [];
    this._wildlife = [];
    this._toast = "";
    this._showAllAttn = false;
    this._dim = {};
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
    this.shadowRoot.addEventListener("input", (e) => this._onDimInput(e));
    this.shadowRoot.addEventListener("change", (e) => this._onDimChange(e));
    // A release that didn't move the slider fires no change event; stop holding renders anyway.
    const endSlide = () => setTimeout(() => {
      if (!this._sliding) return;
      this._sliding = false;
      this._scheduleRender();
    });
    this.shadowRoot.addEventListener("pointerup", endSlide);
    this.shadowRoot.addEventListener("pointercancel", endSlide);
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (first && this.isConnected) this._refreshAll();
    this._subscribe();
    this._scheduleRender();
  }

  get hass() {
    return this._hass;
  }

  set narrow(v) {
    this._narrow = v;
    this._scheduleRender();
  }

  set panel(p) {
    this._cfg = p?.config || {};
    this._scheduleRender();
  }

  connectedCallback() {
    loadFont();
    this._tick = setInterval(() => this._render(), 30000);
    this._wxTimer = setInterval(() => this._loadWeather(), WEATHER_REFRESH_MS);
    this._histTimer = setInterval(() => this._loadHistory(), HISTORY_REFRESH_MS);
    this._calTimer = setInterval(() => this._loadCalendars(), CALENDAR_REFRESH_MS);
    this._wildTimer = setInterval(() => this._loadWildlife(), 10 * 60e3);
    if (this._hass) this._refreshAll();
    this._subscribe();
    this._scheduleRender();
  }

  disconnectedCallback() {
    [this._tick, this._wxTimer, this._histTimer, this._calTimer, this._wildTimer].forEach(clearInterval);
    this._unsub?.();
    this._unsub = null;
    this._subscribing = false;
  }

  get _c() {
    return { weather: "weather.home", lights: [], climate: [], cameras: [], links: {}, calendars_exclude: [], ...(this._cfg || {}) };
  }

  _refreshAll() {
    this._loadWeather();
    this._loadHistory();
    this._loadCalendars();
    this._loadWildlife();
  }

  // Frigate wildlife detections for the outdoor timeline (last 24 h).
  async _loadWildlife() {
    const o = this._c.outdoor;
    if (!this._hass || !o?.wildlife_labels?.length) return;
    try {
      let res = await this._hass.callWS({
        type: "frigate/events/get",
        instance_id: o.frigate_instance || "frigate",
        labels: o.wildlife_labels,
        after: Math.floor((Date.now() - 864e5) / 1000),
        limit: 200,
      });
      if (typeof res === "string") res = JSON.parse(res);
      this._wildlife = (Array.isArray(res) ? res : []).map((e) => ({ at: e.start_time * 1000, label: e.label, camera: e.camera }));
      this._scheduleRender();
    } catch (_) {
      /* timeline still works without wildlife */
    }
  }

  // HA's own daily forecast is only the fallback for when Open-Meteo can't be reached directly.
  _subscribe() {
    const w = this._c.weather;
    if (!this._hass || !this.isConnected || this._unsub || this._subscribing || !this._hass.states[w]) return;
    this._subscribing = true;
    this._hass.connection
      .subscribeMessage((m) => {
        this._haForecast = m.forecast || [];
        this._scheduleRender();
      }, { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: w })
      .then((u) => (this._subscribing ? (this._unsub = u) : u()))
      .catch(() => {})
      .finally(() => (this._subscribing = false));
  }

  // 10-day + hourly forecast straight from Open-Meteo (keyless, CORS-enabled), at HA's home location.
  async _loadWeather() {
    const cfg = this._hass?.config;
    if (!cfg || !Number.isFinite(cfg.latitude)) return;
    const f = cfg.unit_system?.temperature === "°F";
    const q = new URLSearchParams({
      latitude: cfg.latitude.toFixed(3),
      longitude: cfg.longitude.toFixed(3),
      timezone: cfg.time_zone || "auto",
      forecast_days: "10",
      temperature_unit: f ? "fahrenheit" : "celsius",
      wind_speed_unit: f ? "mph" : "kmh",
      precipitation_unit: f ? "inch" : "mm",
      current: "temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,is_day,wind_speed_10m",
      hourly: "temperature_2m,precipitation_probability,weather_code,is_day",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset",
    });
    try {
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${q}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const wx = await res.json();
      wx.units = { wind: f ? "mph" : "km/h" };
      this._wx = wx;
      this._wxAt = Date.now();
      this._scheduleRender();
    } catch (_) {
      /* keep the last good forecast; with none, fall back to the HA weather entity */
    }
  }

  async _loadHistory() {
    const o = this._c.outdoor || {};
    const ids = [...this._c.climate.flatMap((r) => [r.temperature, r.humidity]), o.score, o.aqi].filter(Boolean);
    if (!this._hass || !ids.length) return;
    try {
      const res = await this._hass.callWS({
        type: "history/history_during_period",
        start_time: new Date(Date.now() - 7 * 864e5).toISOString(),
        entity_ids: ids,
        minimal_response: true,
        no_attributes: true,
        significant_changes_only: false,
      });
      const out = {};
      for (const [id, rows] of Object.entries(res || {})) out[id] = rows.map((r) => [(r.lc ?? r.lu) * 1000, num(r.s)]).filter((p) => p[1] !== null);
      this._hist = out;
      this._scheduleRender();
    } catch (_) {
      /* trends are optional */
    }
  }

  // Every calendar.* entity (e.g. Google Calendar) except ones excluded in config.
  async _loadCalendars() {
    if (!this._hass) return;
    const ids = Object.keys(this._hass.states).filter((id) => id.startsWith("calendar.") && !this._c.calendars_exclude.includes(id));
    if (!ids.length) {
      this._events = [];
      return;
    }
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + 8 * 864e5);
    const q = `start=${encodeURIComponent(start.toISOString())}&end=${encodeURIComponent(end.toISOString())}`;
    const all = [];
    await Promise.all(
      ids.map(async (id) => {
        try {
          const evs = await this._hass.callApi("GET", `calendars/${id}?${q}`);
          const calName = this._hass.states[id]?.attributes?.friendly_name || id;
          for (const e of evs || []) {
            const allDay = !e.start?.dateTime;
            const at = allDay ? new Date(`${e.start.date}T00:00:00`).getTime() : Date.parse(e.start.dateTime);
            const endAt = e.end ? (e.end.dateTime ? Date.parse(e.end.dateTime) : new Date(`${e.end.date}T00:00:00`).getTime()) : at;
            all.push({ at, end: endAt, allDay, title: e.summary || "(no title)", sub: [calName, e.location].filter(Boolean).join(" · "), cal: true });
          }
        } catch (_) {
          /* one broken calendar shouldn't hide the others */
        }
      }),
    );
    this._events = all;
    this._scheduleRender();
  }

  _scheduleRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = 0;
      this._render();
    });
  }

  _navigate(path) {
    window.history.pushState(null, "", path);
    window.dispatchEvent(new CustomEvent("location-changed", { detail: { replace: false } }));
  }

  _showToast(msg, ok = false) {
    this._toast = msg;
    this._toastOk = ok;
    this._render();
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this._toast = "";
      this._render();
    }, 6000);
  }

  async _onClick(e) {
    const el = e.target.closest?.("[data-action]");
    if (!el || !this._hass || el.disabled) return;
    const a = el.dataset.action;
    if (a === "menu") this.dispatchEvent(new Event("hass-toggle-menu", { bubbles: true, composed: true }));
    else if (a === "nav" && el.dataset.path) this._navigate(el.dataset.path);
    else if (a === "scroll") this.shadowRoot.querySelector(el.dataset.target)?.scrollIntoView({ behavior: "smooth", block: "start" });
    else if (a === "range") {
      this._range = el.dataset.range;
      this._render();
    } else if (a === "watered") {
      const t = this._c.trees || {};
      try {
        await this._hass.callService("script", "turn_on", { entity_id: t.mark_watered || "script.trees_mark_watered" });
        this._showToast(`Watering logged at ${this._fmtTime(Date.now())}.`, true);
      } catch (err) {
        this._showToast(`Couldn't log watering: ${err.message || err}`);
      }
    } else if (a === "more-attn") {
      this._showAllAttn = !this._showAllAttn;
      this._render();
    } else if (a === "toggle") {
      const id = el.dataset.entity;
      try {
        await this._hass.callService(id.startsWith("light.") ? "light" : "homeassistant", "toggle", { entity_id: id });
      } catch (err) {
        this._showToast(`Couldn't toggle ${id}: ${err.message || err}`);
      }
    }
  }

  // While dragging, update the tile in place; a full re-render would snap the slider back.
  _onDimInput(e) {
    const el = e.target;
    if (!el.matches?.("input.dimmer")) return;
    this._sliding = true;
    el.style.setProperty("--pct", `${el.value}%`);
    const label = el.closest(".sw")?.querySelector(".sw-tap span");
    if (label) label.textContent = +el.value ? `On · ${el.value}%` : "Off";
  }

  async _onDimChange(e) {
    const el = e.target;
    if (!el.matches?.("input.dimmer") || !this._hass) return;
    this._sliding = false;
    const id = el.dataset.entity;
    const pct = +el.value;
    // Hold the chosen level until HA reports it, so the slider doesn't flick back meanwhile.
    this._dim[id] = { pct, at: Date.now() };
    this._scheduleRender();
    try {
      if (pct) await this._hass.callService("light", "turn_on", { entity_id: id, brightness_pct: pct });
      else await this._hass.callService("light", "turn_off", { entity_id: id });
    } catch (err) {
      delete this._dim[id];
      this._showToast(`Couldn't dim ${id}: ${err.message || err}`);
    }
  }

  _hour12() {
    const tf = this._hass?.locale?.time_format;
    return tf === "12" ? true : tf === "24" ? false : undefined;
  }

  _fmtTime(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12: this._hour12() });
  }

  _fmtHour(ms) {
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", hour12: this._hour12() }).replace(/\s/g, "").toLowerCase();
  }

  // "today at 7:48 AM", "yesterday at 12:20 PM", "Mon, Oct 5 at 9:00 AM"
  _pastLabel(ms) {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(ms)) / 864e5);
    const day = diff === 0 ? "today" : diff === 1 ? "yesterday" : new Date(ms).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return `${day} at ${this._fmtTime(ms)}`;
  }

  _when(ms) {
    return `${dayLabel(ms)} ${this._fmtTime(ms)}`;
  }

  // ---- domain reads: tiles return { level, state, sub }; all may add attention/agenda items ----

  _security(attn) {
    const st = this._hass.states;
    const go = this._c.links.security;
    for (const c of this._c.cameras) {
      for (const s of ALARM_SOUNDS)
        if (st[`binary_sensor.${c}_${s}_sound`]?.state === "on") attn.push({ level: "red", icon: "mdiAlarmLight", title: `${nice(s)} detected · ${nice(c)}`, text: "Open Security to see the camera.", go });
      if (st[`camera.${c}`] && !live(st[`camera.${c}`])) attn.push({ level: "red", icon: "mdiCctvOff", title: `${nice(c)} camera is offline`, text: "Nothing is being watched or recorded there.", go });
      if (st[`binary_sensor.${c}_stream_active`]?.state === "off" || st[`switch.${c}_recordings`]?.state === "off" || st[`switch.${c}_detect`]?.state === "off")
        attn.push({ level: "amber", icon: "mdiCctv", title: `${nice(c)} camera isn't fully watching`, text: "Video, recording or detection is switched off.", go });
    }
    this._ring = null;
    const d = this._c.doorbell;
    if (!d) return;
    const name = d.name || "Front door";
    const ents = [d.camera, d.ring, d.battery].map((id) => (id ? st[id] : undefined));
    // Entities that don't exist yet mean the integration isn't installed: show nothing rather than an outage.
    if (ents.some(Boolean) && !ents.some(live))
      attn.push({ level: "red", icon: "mdiDoorbell", title: `${name} doorbell isn't reporting`, text: "Rings won't reach Home Assistant until the Eufy bridge is back.", go });
    const at = live(st[d.ring]) ? Date.parse(st[d.ring].state) : NaN;
    if (Number.isFinite(at) && Date.now() - at < RING_NOW_MS) {
      this._ring = { name, at };
      attn.push({ level: "info", icon: "mdiDoorbell", title: `${name} doorbell rang at ${this._fmtTime(at)}`, text: "Open Security to see who's there.", go });
    }
  }

  _media() {
    const st = this._hass.states;
    const players = (this._c.media || []).map((m) => ({ ...m, s: st[m.entity] })).filter((m) => m.s);
    const playing = players.filter((m) => m.s.state === "playing");
    if (playing.length) {
      const m = playing[0];
      return { level: "blue", state: m.s.attributes.media_title || m.s.attributes.app_name || "Playing", sub: `${m.name}${playing.length > 1 ? ` +${playing.length - 1}` : ""}` };
    }
    const paused = players.find((m) => m.s.state === "paused");
    if (paused) return { level: "", state: "Paused", sub: paused.name };
    return { level: "", state: "Nothing playing", sub: players.map((m) => m.name).join(" · ") };
  }

  _irrigation(attn, agenda) {
    const st = this._hass.states;
    let controller = null;
    let nextRun = null;
    const running = [];
    for (const [id, s] of Object.entries(st)) {
      const a = s.attributes || {};
      if (a.opensprinkler_type === "controller" && id.startsWith("switch.")) controller = s;
      else if (a.opensprinkler_type === "station" && id.endsWith("_station_running") && s.state === "on") running.push(String(a.name || "").trim());
      else if (a.next_run_program_name !== undefined && live(s)) nextRun = { at: Date.parse(s.state), program: String(a.next_run_program_name).trim() };
    }
    if (!controller) return null;
    const go = this._c.links.irrigation;
    if (nextRun && nextRun.at > Date.now()) agenda.push({ at: nextRun.at, icon: "mdiSprinklerVariant", title: "Watering", sub: nextRun.program, go });
    if (st["binary_sensor.opensprinkler_rain_delay_active"]?.state === "on") attn.push({ level: "info", icon: "mdiUmbrellaOutline", title: "Irrigation rain delay is on", text: "Scheduled watering is paused.", go });
    if (!live(controller)) return { level: "", state: "Unavailable", sub: "Can't reach OpenSprinkler" };
    if (controller.state === "off") {
      attn.push({ level: "info", icon: "mdiSprinklerVariant", title: "Irrigation controller is off", text: "No watering will run until it's turned back on.", go });
      return { level: "", state: "Off", sub: "Controller turned off" };
    }
    if (running.length) return { level: "blue", state: "Watering now", sub: running.join(", ") };
    return { level: "green", state: "Idle", sub: nextRun && nextRun.at > Date.now() ? `Next ${this._when(nextRun.at)}` : "Nothing scheduled" };
  }

  _recordings(attn, agenda) {
    const st = this._hass.states[this._c.recordings];
    if (!st) return null;
    const a = st.attributes || {};
    const now = Date.now();
    const go = this._c.links.recordings;
    const queue = (a.plex_queue || []).map((q) => ({ ...q, at: q.air_time ? Date.parse(q.air_time) : null, lands: q.lands_after ? Date.parse(q.lands_after) : null }));
    const upcoming = queue.filter((q) => q.at && q.at > now).sort((x, y) => x.at - y.at);
    const airing = queue.filter((q) => q.at && q.at <= now && (q.lands ?? q.at) > now);
    for (const q of upcoming.slice(0, 3)) agenda.push({ at: q.at, icon: "mdiTelevisionClassic", title: q.title, sub: "Recording", go });
    for (const e of a.errors || []) attn.push({ level: "red", icon: "mdiCalendarRemove", title: `Couldn't schedule ${e.title || "a recording"}`, text: e.error || "Plex API error", go });
    if (a.library_healthy === false) attn.push({ level: "red", icon: "mdiTelevisionClassic", title: "Recordings library problem", text: "Plex isn't indexing recordings.", go });
    const used = num(a.disk?.filesystem_used_percent);
    if (used !== null && used >= 85) attn.push({ level: "amber", icon: "mdiHarddisk", title: `Recordings disk ${Math.round(used)}% full`, text: `${Math.round(num(a.disk.filesystem_avail_gb) ?? 0)} GB free.`, go });
    for (const o of queue.filter((q) => !q.at)) attn.push({ level: "info", icon: "mdiCalendarQuestion", title: `${o.show || o.title}: nothing scheduled`, text: "Stale Plex DVR subscription; remove it if you're done with it.", go });
    if (!live(st)) return { level: "", state: "No data", sub: "Sync data unavailable" };
    if ((a.errors || []).length) return { level: "red", state: `Couldn't schedule ${a.errors.length}`, sub: a.errors[0].title || "" };
    if (airing.length) return { level: "blue", state: "Recording now", sub: airing.map((q) => q.title).join(", ") };
    if (upcoming.length) return { level: "green", state: upcoming[0].title, sub: this._when(upcoming[0].at) };
    return { level: "green", state: "Nothing scheduled", sub: "" };
  }

  _network(attn) {
    const st = this._hass.states;
    const c = this._c.network || {};
    const go = this._c.links.network;
    const lat = Object.entries(c.latency || {}).map(([label, id]) => ({ label, s: st[id] })).filter((l) => l.s);
    if (!lat.length) return null;
    const ok = lat.filter((l) => live(l.s));
    const best = ok.length ? Math.min(...ok.map((l) => num(l.s.state))) : null;
    const devs = st[c.devices];
    const devices = live(devs) ? devs.attributes.data || [] : null;
    const offline = (devices || [])
      .filter((d) => d.state !== "ONLINE" && !(c.retired || []).includes(d.id))
      .map((d) => {
        const hb = st[(c.stats || {})[d.id]]?.attributes?.lastHeartbeatAt;
        return { ...d, hb, long: !!hb && Date.now() - Date.parse(hb) > LONG_OFFLINE_MS };
      });
    for (const d of offline)
      attn.push({
        level: d.long ? "info" : "amber",
        icon: "mdiAccessPointOff",
        title: `${d.name} access point offline`,
        text: d.hb ? `Last seen ${new Date(Date.parse(d.hb)).toLocaleDateString([], { month: "short", day: "numeric" })}.${d.long ? " Mark it retired if it's gone for good." : ""}` : "Not responding.",
        go,
      });
    if (devs && !devices) attn.push({ level: "info", icon: "mdiLanDisconnect", title: "Wi-Fi details unavailable", text: "HA can't read the UniFi Network app right now; the internet itself is checked separately.", go });
    if (!ok.length) {
      attn.push({ level: "red", icon: "mdiWebOff", title: "Internet is down", text: `No replies from ${lat.map((l) => l.label).join(" or ")}.`, go });
      return { level: "red", state: "Internet down", sub: "No ping replies" };
    }
    if (best > 100) return { level: "amber", state: "Internet slow", sub: `${Math.round(best)} ms` };
    const recent = offline.filter((d) => !d.long);
    if (recent.length) return { level: "amber", state: "Wi-Fi degraded", sub: `${recent.map((d) => d.name).join(", ")} offline` };
    return { level: "green", state: "Internet OK", sub: `${Math.round(best)} ms${devices ? ` · ${devices.filter((d) => d.state === "ONLINE").length} devices up` : " · Wi-Fi details unavailable"}` };
  }

  // Thermometers with no advert for 20+ min (packages/bluetooth_health.yaml): entity_id -> since (ms).
  _staleThermometers() {
    const id = this._c.thermometer_health;
    const list = (id && this._hass.states[id]?.attributes?.stale) || [];
    return new Map(list.map((x) => [x.entity_id, x.since ? Date.parse(x.since) : NaN]));
  }

  _general(attn) {
    const st = this._hass.states;
    const stale = this._staleThermometers();
    const rooms = this._c.climate.filter((r) => stale.has(r.temperature));
    if (rooms.length) {
      const since = Math.min(...rooms.map((r) => stale.get(r.temperature)).filter(Number.isFinite));
      attn.push({ level: "amber", icon: "mdiThermometer", title: `${rooms.map((r) => r.name).join(" & ")} thermometer${rooms.length > 1 ? "s" : ""} offline`, text: `${Number.isFinite(since) ? `No reading since ${this._pastLabel(since)}. ` : ""}Bluetooth self-heal is retrying.` });
    }
    const updates = Object.values(st).filter((s) => s.entity_id?.startsWith("update.") && s.state === "on");
    if (updates.length)
      attn.push({ level: "info", icon: "mdiUpdate", title: `${plural(updates.length, "update")} available`, text: updates.map((u) => (u.attributes.friendly_name || u.entity_id).replace(/ (Firmware|update)$/i, "")).join(", "), go: "/config/updates" });
    for (const b of Object.values(st).filter((s) => s.attributes?.device_class === "battery" && s.entity_id?.startsWith("sensor.") && num(s.state) !== null && num(s.state) < 20))
      attn.push({ level: "amber", icon: "mdiBatteryAlert", title: `${(b.attributes.friendly_name || b.entity_id).replace(/ battery( level)?$/i, "")} battery low`, text: `${Math.round(num(b.state))}% left.` });
  }

  _sunAgenda(agenda) {
    const st = this._hass.states;
    const sun = st["sun.sun"]?.attributes || {};
    if (sun.next_setting)
      agenda.push({ at: Date.parse(sun.next_setting), icon: "mdiWeatherSunset", title: "Sunset", sub: st["automation.front_yard_lights_on_at_sunset"]?.state === "on" ? "Yard lights turn on" : "" });
    if (st["automation.front_yard_lights_off_at_21_00"]?.state === "on") {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      agenda.push({ at: d.getTime(), icon: "mdiCoachLamp", title: "Yard lights off", sub: "Automation" });
    }
  }

  // ---- weather ----

  _weatherModel(agenda) {
    const wx = this._wx;
    if (wx?.daily?.time?.length) {
      const cur = wx.current || {};
      const [label, icon] = wmo(cur.weather_code, cur.is_day !== 0);
      const days = wx.daily.time.map((d, i) => ({
        at: new Date(`${d}T12:00:00`).getTime(),
        code: wx.daily.weather_code[i],
        hi: wx.daily.temperature_2m_max[i],
        lo: wx.daily.temperature_2m_min[i],
        pp: wx.daily.precipitation_probability_max?.[i] ?? null,
      }));
      const fromHour = Date.now() - 3600e3;
      const hours = wx.hourly.time
        .map((t, i) => ({ at: new Date(t).getTime(), t: wx.hourly.temperature_2m[i], pp: wx.hourly.precipitation_probability?.[i] ?? 0, code: wx.hourly.weather_code[i], day: wx.hourly.is_day?.[i] !== 0 }))
        .filter((h) => h.at >= fromHour)
        .slice(0, 25);
      const rainy = days.find((d) => (d.pp ?? 0) >= 50);
      if (rainy) agenda.push({ at: Math.max(Date.now() + 60e3, startOfDay(rainy.at) + 8 * 3600e3), icon: "mdiWeatherRainy", title: `${rainy.pp}% chance of rain`, sub: wmo(rainy.code)[0], allDay: true });
      return {
        source: "open-meteo",
        temp: cur.temperature_2m,
        feels: cur.apparent_temperature,
        humidity: cur.relative_humidity_2m,
        wind: cur.wind_speed_10m,
        windUnit: wx.units.wind,
        label,
        icon,
        night: cur.is_day === 0,
        sunrise: wx.daily.sunrise?.[0] ? new Date(wx.daily.sunrise[0]).getTime() : null,
        sunset: wx.daily.sunset?.[0] ? new Date(wx.daily.sunset[0]).getTime() : null,
        days,
        hours,
      };
    }
    // Fallback: HA's Open-Meteo entity (7 days, no hourly chance of rain).
    const st = this._hass.states[this._c.weather];
    if (!live(st)) return null;
    let cond = st.state;
    if (cond === "sunny" && this._hass.states["sun.sun"]?.state === "below_horizon") cond = "clear-night";
    const [label, icon] = HA_CONDITION[cond] || [nice(cond), "mdiWeatherPartlyCloudy"];
    const days = (this._haForecast || []).map((d) => ({ at: Date.parse(d.datetime), code: null, cond: d.condition, hi: num(d.temperature), lo: num(d.templow), pp: d.precipitation_probability ?? null }));
    return { source: "ha", temp: num(st.attributes.temperature), label, icon, night: cond === "clear-night", days, hours: [] };
  }

  _weatherCard(w) {
    if (!w) return `<section class="card a-weather"><div class="wx-main"><div class="eyebrow">Weather</div><div class="empty">Weather unavailable.</div></div></section>`;
    const r = (v) => (v === null || v === undefined ? "—" : Math.round(v));
    const today = w.days[0];
    let hourly = "";
    if (w.hours.length > 2) {
      // Next 24 h: temperature line over chance-of-rain bars.
      const W = 600;
      const H = 150;
      const temps = w.hours.map((h) => h.t);
      const lo = Math.min(...temps) - 2;
      const hi = Math.max(...temps) + 2;
      const path = linePath(w.hours.map((h) => [h.at, h.t]), W, H - 34, lo, hi, 10);
      const bw = W / w.hours.length;
      const bars = w.hours
        .map((h, i) => (h.pp >= 10 ? `<rect class="pbar" x="${(i * bw + bw * 0.2).toFixed(1)}" y="${(H - (h.pp / 100) * 30).toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${((h.pp / 100) * 30).toFixed(1)}" rx="2"/>` : ""))
        .join("");
      const ticks = w.hours.filter((_, i) => i % 3 === 0).slice(0, 9);
      hourly = `<div class="hourly">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <defs><linearGradient id="tfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="rgba(252,211,77,.28)"/><stop offset="1" stop-color="rgba(252,211,77,0)"/></linearGradient></defs>
          ${bars}<path class="tarea" d="${path}L${W},${H - 34}L0,${H - 34}Z"/><path class="tline" d="${path}"/>
        </svg>
        <div class="hours">${ticks
          .map((h, i) => `<div><span>${i === 0 ? "Now" : esc(this._fmtHour(h.at))}</span>${svg(wmo(h.code, h.day)[1])}<b>${r(h.t)}°</b><span class="pp">${h.pp >= 20 ? `${h.pp}%` : ""}</span></div>`)
          .join("")}</div>
        <div class="hint"><span><i style="background:var(--gold)"></i>Temperature, next 24 h</span><span><i style="background:rgba(76,195,255,.55)"></i>Chance of rain</span></div>
      </div>`;
    }
    // Daily rows on a shared low-high scale, like a phone weather app.
    const los = w.days.map((d) => d.lo).filter((v) => v !== null && v !== undefined);
    const his = w.days.map((d) => d.hi).filter((v) => v !== null && v !== undefined);
    const allLo = Math.min(...los);
    const span = Math.max(...his) - allLo || 1;
    const daysHtml = w.days
      .map((d, i) => {
        const [lbl, ic] = d.code !== null && d.code !== undefined ? wmo(d.code) : HA_CONDITION[d.cond] || ["", "mdiWeatherPartlyCloudy"];
        const left = d.lo === null ? 0 : ((d.lo - allLo) / span) * 100;
        const width = d.hi === null || d.lo === null ? 0 : ((d.hi - d.lo) / span) * 100;
        const name = i === 0 ? "Today" : new Date(d.at).toLocaleDateString([], { weekday: "short" });
        return `<div class="day" title="${esc(lbl)}"><span class="dn">${esc(name)}</span>${svg(ic)}<span class="pp">${(d.pp ?? 0) >= 20 ? `${d.pp}%` : ""}</span>
          <div class="range"><span class="lo">${r(d.lo)}°</span><div class="track"><i style="left:${left.toFixed(1)}%;width:${Math.max(4, width).toFixed(1)}%"></i></div><span class="hi">${r(d.hi)}°</span></div></div>`;
      })
      .join("");
    const facts = [
      w.feels != null ? `<span>${svg("mdiThermometer")}Feels like ${r(w.feels)}°</span>` : "",
      w.humidity != null ? `<span>${svg("mdiWaterPercent")}${r(w.humidity)}% humidity</span>` : "",
      w.wind != null ? `<span>${svg("mdiWeatherWindy")}${r(w.wind)} ${esc(w.windUnit)}</span>` : "",
      w.sunrise ? `<span>${svg("mdiWeatherSunsetUp")}${esc(this._fmtTime(w.sunrise))}</span>` : "",
      w.sunset ? `<span>${svg("mdiWeatherSunsetDown")}${esc(this._fmtTime(w.sunset))}</span>` : "",
    ].join("");
    return `<section class="card a-weather">
      <div class="wx-main">
        <div class="wx-now">
          ${svg(w.icon, w.night ? "night" : "")}
          <div class="wx-temp">${r(w.temp)}°</div>
          <div><div class="wx-cond">${esc(w.label)}</div>${today ? `<div class="wx-hl">H ${r(today.hi)}° · L ${r(today.lo)}°</div>` : ""}</div>
        </div>
        ${facts ? `<div class="wx-facts">${facts}</div>` : ""}
        ${hourly}
      </div>
      <div class="wx-days">
        <div class="eyebrow">${w.days.length}-day forecast</div>
        ${daysHtml || `<div class="empty">Forecast unavailable.</div>`}
        <div class="wx-src">${w.source === "open-meteo" ? `Open-Meteo · updated ${esc(this._fmtTime(this._wxAt))}` : "From HA's weather entity (Open-Meteo direct unavailable)"}</div>
      </div>
    </section>`;
  }

  // ---- climate trends ----

  _roomCard(room, withSwitch) {
    const st = this._hass.states;
    const week = this._range === "7d";
    const since = Date.now() - (week ? 7 * 864e5 : 864e5);
    const staleSince = this._staleThermometers().get(room.temperature);
    const stale = staleSince !== undefined;
    const tNow = live(st[room.temperature]) ? num(st[room.temperature].state) : null;
    const hNow = room.humidity && live(st[room.humidity]) ? num(st[room.humidity].state) : null;
    const series = (id) => {
      const all = this._hist[id] || [];
      // Carry the last value from before the window so the line starts at the left edge.
      const before = all.filter((p) => p[0] < since).pop();
      const inside = all.filter((p) => p[0] >= since);
      const pts = before ? [[since, before[1]], ...inside] : inside;
      // A quiet thermometer has no "now"; don't draw its last value forward as if it were current.
      if (pts.length && !stale) pts.push([Date.now(), pts[pts.length - 1][1]]);
      return thin(pts);
    };
    const tp = series(room.temperature);
    const hp = room.humidity ? series(room.humidity) : [];
    let chart = `<div class="empty">Collecting history…</div>`;
    let delta = "";
    if (tp.length > 2) {
      const W = 600;
      const H = 120;
      const tv = tp.map((p) => p[1]);
      const lo = Math.floor(Math.min(...tv) - 1);
      const hi = Math.ceil(Math.max(...tv) + 1);
      const tPath = linePath(tp, W, H, lo, hi);
      const hv = hp.map((p) => p[1]);
      const hPath = hp.length > 2 ? linePath(hp, W, H, Math.min(...hv) - 5, Math.max(...hv) + 5) : "";
      chart = `<div class="trend">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
          <line class="grid-l" x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}"/>
          <path class="a-temp" d="${tPath}L${W},${H}L0,${H}Z"/>
          ${hPath ? `<path class="l-hum" d="${hPath}"/>` : ""}
          <path class="l-temp" d="${tPath}"/>
        </svg>
        <div class="axis"><span>${week ? "7 days ago" : "24 h ago"}</span><span>Low ${Math.round(Math.min(...tv))}° · High ${Math.round(Math.max(...tv))}°</span><span>Now</span></div>
        <div class="legend"><span><i style="background:var(--gold)"></i>Temperature</span>${hPath ? `<span><i style="background:var(--sky)"></i>Humidity (own scale, ${Math.round(Math.min(...hv))}–${Math.round(Math.max(...hv))}%)</span>` : ""}</div>
      </div>`;
      const d = tv[tv.length - 1] - tv[0];
      delta = Math.abs(d) < 0.5 ? `Same as ${week ? "a week ago" : "this time yesterday"}` : `${d > 0 ? "Up" : "Down"} ${Math.abs(d).toFixed(1)}° since ${week ? "a week ago" : "this time yesterday"}`;
    }
    const seg = withSwitch
      ? `<span class="seg"><button data-action="range" data-range="24h" class="${week ? "" : "on"}">24 h</button><button data-action="range" data-range="7d" class="${week ? "on" : ""}">7 days</button></span>`
      : "";
    const note = stale ? `<span class="delta stale-note">${esc(Number.isFinite(staleSince) ? `No reading since ${this._pastLabel(staleSince)}` : "No recent reading")}</span>` : `<span class="delta">${esc(delta)}</span>`;
    return `<section class="card room${stale ? " stale" : ""}">
      <div class="head"><span class="eyebrow">${esc(room.name)}</span>${seg}</div>
      <div class="now"><b>${tNow === null ? "—" : `${tNow.toFixed(1)}°`}</b>${hNow !== null && !stale ? `<span>${Math.round(hNow)}% humidity</span>` : ""}${note}</div>
      ${chart}
    </section>`;
  }

  _treesCard() {
    const t = this._c.trees;
    if (!t) return "";
    const st = this._hass.states;
    const d = st[t.decision];
    if (!d) return `<section class="card a-trees"><div class="eyebrow">Trees</div><div class="empty">Trees sensors not set up.</div></section>`;
    const a = d.attributes || {};
    const code = a.code || "skip";
    const water = code.startsWith("water");
    const cls = code === "water_final" ? "final" : water ? "water" : "skip";
    const title = { water: "Water today", water_final: "Final deep watering", water_winter: "Winter watering today" }[code] || "Skip today";
    const lw = st[t.last_watered]?.state;
    const lwMs = lw ? Date.parse(lw.replace(" ", "T")) : NaN;
    const lwText = !Number.isFinite(lwMs) || new Date(lwMs).getFullYear() < 2000 ? "No watering logged yet" : `Last watered ${dayLabel(lwMs).toLowerCase()} at ${this._fmtTime(lwMs)}`;
    const num1 = (v, u) => (v === undefined || v === null || v === "" || v === "None" ? "—" : `${Math.round(parseFloat(v) * 100) / 100}${u}`);
    const notify = st[t.notify_time]?.state;
    return `<section class="card a-trees">
      <div class="head"><span class="eyebrow">Trees · ${esc(a.season || "")}</span>${notify ? `<span class="muted">Reminder ${esc(notify.slice(0, 5))}</span>` : ""}</div>
      <div class="verdict ${cls}"><div class="vic">${svg(water ? "mdiWateringCan" : "mdiCheckCircleOutline")}</div><div><b>${esc(title)}</b><span>Hot Wings maple · Sensation boxelder</span></div></div>
      <div class="why2">${esc(a.reason || "")}</div>
      ${water ? `<div class="do"><div>${svg("mdiWateringCan")}<span>${esc(a.how_much || "")}</span></div><div>${svg("mdiClockOutline")}<span>${esc(a.when || "")}</span></div></div>` : ""}
      <div class="facts">
        <div class="fact"><b>${esc(num1(a.rain_7d, " in"))}</b><span>Rain, 7 days</span></div>
        <div class="fact"><b>${esc(a.days_since_rain ?? "—")}</b><span>Days since rain</span></div>
        <div class="fact"><b>${esc(num1(a.soil_temp, "°F"))}</b><span>Soil at 2 in</span></div>
        <div class="fact"><b>${esc(String(a.next_hard_freeze || "—").replace("None in the NWS forecast", "None forecast"))}</b><span>Next hard freeze</span></div>
      </div>
      <div class="trees-foot"><span>${esc(lwText)}</span><button class="btn" data-action="watered">${svg("mdiCheck")}I watered</button></div>
    </section>`;
  }

  _outdoorCard() {
    const o = this._c.outdoor;
    if (!o) return "";
    const st = this._hass.states;
    const score = num(st[o.score]?.state);
    const level = st[o.level]?.state;
    const aqiSt = st[o.aqi];
    if (score === null) {
      const missing = [!live(st[o.airnow]) && "AirNow", !live(st[o.purpleair_pm25]) && "PurpleAir"].filter(Boolean);
      return `<section class="card a-outdoor"><div class="eyebrow">Outdoor score</div>
        <div class="empty">Waiting for air-quality data${missing.length ? ` (${esc(missing.join(" and "))} not set up yet)` : ""}.</div></section>`;
    }
    const color = { green: "var(--green)", yellow: "var(--amber)", red: "var(--red)" }[level] || "var(--grey)";
    const R = 46;
    const C = 2 * Math.PI * R;
    const sa = st[o.score]?.attributes || {};
    const gust = num(st[o.wind_gust]?.state);
    const pm = num(st[o.purpleair_pm25]?.state);
    // 24 h timeline: score (0-100) and AQI on a shared 0-200 axis, wildlife ticks along the bottom.
    const since = Date.now() - 864e5;
    const series = (id) => thin((this._hist[id] || []).filter((p) => p[0] >= since));
    const sp = series(o.score);
    const ap = series(o.aqi);
    const W = 600;
    const H = 130;
    const xOf = (t) => ((t - since) / 864e5) * W;
    const yOf = (v, max) => 6 + (1 - Math.min(v, max) / max) * (H - 30);
    const pathOf = (pts, max) => pts.map(([t, v], i) => `${i ? "L" : "M"}${xOf(t).toFixed(1)},${yOf(v, max).toFixed(1)}`).join("");
    const wild = this._wildlife.filter((w) => w.at >= since);
    const counts = Object.entries(wild.reduce((m, w) => ((m[w.label] = (m[w.label] || 0) + 1), m), {}));
    const timeline =
      sp.length > 1 || wild.length
        ? `<div class="timeline"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
            <rect class="band" x="0" y="${yOf(100, 100)}" width="${W}" height="${yOf(num(st["input_number.outdoor_green_min"]?.state) ?? 70, 100) - yOf(100, 100)}" fill="var(--green)"/>
            ${sp.length > 1 ? `<path class="l-score" d="${pathOf(sp, 100)}" style="stroke:${color}"/>` : ""}
            ${ap.length > 1 ? `<path class="l-aqi" d="${pathOf(ap, 200)}"/>` : ""}
            ${wild.map((w) => `<line class="wl" x1="${xOf(w.at).toFixed(1)}" y1="${H - 22}" x2="${xOf(w.at).toFixed(1)}" y2="${H - 8}"/><circle class="wd" cx="${xOf(w.at).toFixed(1)}" cy="${H - 6}" r="3"><title>${esc(nice(w.label))} · ${esc(w.camera)} · ${esc(this._fmtTime(w.at))}</title></circle>`).join("")}
          </svg>
          <div class="axis"><span>24 h ago</span><span>Now</span></div>
          <div class="legend"><span><i style="background:${color}"></i>Outdoor score</span><span><i style="background:#c084fc"></i>AQI (0–200)</span><span><i style="background:var(--gold);height:8px;width:8px;border-radius:50%"></i>Wildlife on cameras</span></div>
          ${counts.length ? `<div class="wild">${counts.map(([l, n]) => `<span>${esc(nice(l))} × ${n}</span>`).join("")}</div>` : ""}
        </div>`
        : `<div class="empty">Collecting history…</div>`;
    return `<section class="card a-outdoor">
      <div class="head"><span class="eyebrow">Outdoor score</span><span class="muted">${esc(aqiSt?.attributes?.source || "")}</span></div>
      <div class="score-row">
        <div class="ring2"><svg viewBox="0 0 112 112"><circle class="tr" cx="56" cy="56" r="${R}"/><circle class="pr" cx="56" cy="56" r="${R}" stroke="${color}" stroke-dasharray="${((C * Math.max(0, Math.min(100, score))) / 100).toFixed(1)} ${C.toFixed(1)}"/></svg>
          <div class="c"><div><b>${Math.round(score)}</b><span>of 100</span></div></div></div>
        <div>
          <div class="lvl ${esc(level || "")}">${esc({ green: "Good to go", yellow: "Use judgment", red: "Stay in" }[level] || "—")}</div>
          <div class="comp">
            <span>AQI ${esc(aqiSt?.state ?? "—")}${pm !== null ? ` · PurpleAir ${pm} µg/m³ (EPA-corrected)` : ""}</span>
            ${gust !== null ? `<span>Wind gusts ${Math.round(gust)} mph</span>` : ""}
            ${sa.climbing && sa.climbing !== "not included" ? `<span>Climbing ${esc(sa.climbing)} · Riding ${esc(sa.riding)}</span>` : ""}
          </div>
        </div>
      </div>
      ${timeline}
    </section>`;
  }

  _render() {
    if (!this._hass || this._sliding) return;
    const c = this._c;
    const st = this._hass.states;
    const attn = [];
    const agenda = [];
    const L = c.links;

    this._security(attn);
    const tiles = [
      { name: "Media", icon: "mdiPlayCircleOutline", go: L.media, ...this._media() },
      { name: "Irrigation", icon: "mdiSprinklerVariant", go: L.irrigation, ...(this._irrigation(attn, agenda) || { level: "", state: "—", sub: "" }) },
      { name: "Recordings", icon: "mdiTelevisionClassic", go: L.recordings, ...(this._recordings(attn, agenda) || { level: "", state: "—", sub: "" }) },
      { name: "Network", icon: "mdiRouterWireless", go: L.network, ...(this._network(attn) || { level: "", state: "—", sub: "" }) },
    ];
    this._general(attn);
    this._sunAgenda(agenda);
    const weather = this._weatherModel(agenda);
    for (const e of this._events) agenda.push({ ...e, icon: "mdiCalendar" });

    const order = { red: 0, amber: 1, info: 2 };
    attn.sort((a, b) => order[a.level] - order[b.level]);
    const urgent = attn.filter((i) => i.level === "red");
    const needs = attn.filter((i) => i.level === "red" || i.level === "amber");

    const person = st[c.person];
    const rawName = (person?.attributes?.friendly_name || this._hass.user?.name || "").split(" ")[0];
    const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const hr = new Date().getHours();
    const greet = hr < 5 ? "Good night" : hr < 12 ? "Good morning" : hr < 18 ? "Good afternoon" : "Good evening";
    const status = urgent.length
      ? { dot: "red", text: urgent[0].title }
      : this._ring
        ? { dot: "blue", text: `Doorbell rang · ${this._fmtTime(this._ring.at)}` }
      : needs.length
        ? { dot: "amber", text: `${plural(needs.length, "thing")} need${needs.length === 1 ? "s" : ""} attention` }
        : { dot: "green", text: "All good at home" };
    const presence = person ? (person.state === "home" ? "Home" : person.state === "not_home" ? "Away" : nice(person.state)) : null;

    const header = `<header class="top a-head">
        ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
        <div class="hello">
          <div class="date">${esc(new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" }))}</div>
          <h1>${esc(greet)}${userName ? `, ${esc(userName)}` : ""}</h1>
          <div class="status"><span class="dot ${status.dot}"></span>
            ${needs.length ? `<button data-action="scroll" data-target=".a-attn"><b>${esc(status.text)}</b></button>` : `<b>${esc(status.text)}</b>`}
            ${presence ? `<span class="chip">${svg(person.state === "home" ? "mdiHomeAccount" : "mdiAccountArrowRight")}${esc(userName || "You")} · ${esc(presence)}</span>` : ""}
          </div>
        </div>
      </header>`;

    const onCount = c.lights.filter((l) => st[l.entity]?.state === "on").length;
    const lights = `<section class="card a-lights">
      <div class="head"><span class="eyebrow">Lights &amp; switches</span><span class="muted">${onCount ? `${onCount} on` : "All off"}</span></div>
      <div class="switches">${c.lights
        .map((l) => {
          const s = st[l.entity];
          const on = s?.state === "on";
          const ok = live(s);
          const icon = svg(SWITCH_ICONS.includes(l.icon) ? l.icon : "mdiLightbulb");
          if (l.entity.startsWith("light.") && dimmable(s)) {
            let pct = brightPct(s);
            const held = this._dim[l.entity];
            if (held && pct !== held.pct && Date.now() - held.at < 5000) pct = held.pct;
            else delete this._dim[l.entity];
            const state = ok ? (pct ? `On · ${pct}%` : "Off") : "Unavailable";
            return `<div class="sw dim ${pct ? "on" : ""} ${ok ? "" : "na"}">
              <button class="sw-tap" data-action="toggle" data-entity="${esc(l.entity)}" aria-pressed="${on}" ${ok ? "" : "disabled"}>
                <div class="sic">${icon}</div><div><b>${esc(l.name)}</b><span>${state}</span></div></button>
              <input class="dimmer" type="range" min="0" max="100" step="1" value="${pct}" style="--pct:${pct}%" data-entity="${esc(l.entity)}" aria-label="${esc(l.name)} brightness" ${ok ? "" : "disabled"}></div>`;
          }
          return `<button class="sw ${on ? "on" : ""}" data-action="toggle" data-entity="${esc(l.entity)}" aria-pressed="${on}" ${ok ? "" : "disabled"}>
            <div class="sic">${icon}</div><div><b>${esc(l.name)}</b><span>${ok ? (on ? "On" : "Off") : "Unavailable"}</span></div></button>`;
        })
        .join("")}</div>
    </section>`;

    const tileHtml = `<div class="tiles a-tiles">${tiles
      .map((t) => {
        const tag = t.go ? "button" : "div";
        return `<${tag} class="tile ${t.level}" ${t.go ? `data-action="nav" data-path="${esc(t.go)}"` : ""}>
          <div class="tile-top"><div class="tic">${svg(t.icon)}</div><span class="tile-name">${esc(t.name)}</span>${t.go ? svg("mdiChevronRight", "go") : ""}</div>
          <div class="tile-state">${esc(t.state)}</div>${t.sub ? `<div class="tile-sub">${esc(t.sub)}</div>` : ""}
        </${tag}>`;
      })
      .join("")}</div>`;

    const climate = c.climate.length ? `<div class="a-climate">${c.climate.map((r, i) => this._roomCard(r, i === 0)).join("")}</div>` : "";

    const now = Date.now();
    const soon = agenda.filter((x) => (x.end ?? x.at) > now && x.at - now < 7 * 864e5).sort((a, b) => a.at - b.at).slice(0, 12);
    let lastDay = null;
    const agendaRows = soon
      .map((x) => {
        const day = x.at < now ? "Today" : dayLabel(x.at);
        const hdr = day !== lastDay ? `<div class="agday">${esc(day)}</div>` : "";
        lastDay = day;
        const when = x.allDay ? (x.cal ? "All day" : "") : x.at < now ? "Now" : this._fmtTime(x.at);
        const inner = `<div class="aic ${x.cal ? "cal" : ""}">${svg(x.icon)}</div><div><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</div><div class="when">${esc(when)}</div>`;
        return hdr + (x.go ? `<button class="ag" data-action="nav" data-path="${esc(x.go)}">${inner}</button>` : `<div class="ag">${inner}</div>`);
      })
      .join("");
    const calCount = Object.keys(st).filter((id) => id.startsWith("calendar.") && !c.calendars_exclude.includes(id)).length;
    const agendaHtml = `<section class="card a-agenda">
      <div class="head"><span class="eyebrow">Up next</span><span class="muted">${calCount ? plural(calCount, "calendar") : "No calendars connected"}</span></div>
      ${agendaRows ? `<div class="agenda">${agendaRows}</div>` : `<div class="empty">Nothing coming up.</div>`}
    </section>`;

    const shown = this._showAllAttn ? attn : attn.slice(0, 5);
    const attnHtml = `<section class="card a-attn">
      <div class="head"><span class="eyebrow">Needs attention</span>${attn.length ? `<span class="muted">${attn.length}</span>` : ""}</div>
      ${
        attn.length
          ? `<div class="items">${shown
              .map((i) => {
                const inner = `${svg(i.icon)}<div><b>${esc(i.title)}</b><span>${esc(i.text || "")}</span></div>${i.go ? svg("mdiChevronRight", "go") : ""}`;
                return i.go ? `<button class="item ${i.level}" data-action="nav" data-path="${esc(i.go)}">${inner}</button>` : `<div class="item ${i.level}">${inner}</div>`;
              })
              .join("")}</div>${attn.length > 5 ? `<button class="link" data-action="more-attn">${this._showAllAttn ? "Show fewer" : `Show all ${attn.length}`}</button>` : ""}`
          : `<div class="allgood">${svg("mdiCheckCircleOutline")} Nothing needs you right now.</div>`
      }
    </section>`;

    const html = `
      <style>${CSS}</style>
      <div class="app ${urgent.length ? "urgent" : ""}">
        ${header}${lights}${this._weatherCard(weather)}${tileHtml}${this._treesCard()}${this._outdoorCard()}${climate}${agendaHtml}${attnHtml}
        ${this._toast ? `<div class="toast${this._toastOk ? " ok" : ""}" role="${this._toastOk ? "status" : "alert"}">${esc(this._toast)}</div>` : ""}
      </div>`;
    if (html !== this._html) {
      this._html = html;
      this.shadowRoot.innerHTML = html;
    }
  }
}

function loadFont() {
  if (document.querySelector("link[href*='family=Outfit']")) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap";
  document.head.appendChild(link);
}

if (!customElements.get("home-panel")) customElements.define("home-panel", HomePanel);
