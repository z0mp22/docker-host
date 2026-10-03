// Home panel: whole-house overview. A dependency-free web component registered
// via panel_custom; entity ids come from panel_custom `config`. Each tile is a
// deliberately simple read of a domain; its own panel has the full detail.

const ICONS = {
  mdiCeilingLight: "M8,9H11V4H13V9H16L20,17H4L8,9M14,18A2,2 0 0,1 12,20A2,2 0 0,1 10,18H14Z",
  mdiDeskLamp: "M10.85,2L9.18,4.5L10.32,5.25L7.14,10C7.1,10 7.05,10 7,10A2,2 0 0,0 5,12C5,12.94 5.66,13.75 6.58,13.95L10.62,20H7V22H17V20H13L8.53,13.28C8.83,12.92 9,12.47 9,12C9,11.7 8.93,11.4 8.8,11.13L12,6.37C11.78,8.05 12.75,9.89 14.45,11L18.89,4.37C17.2,3.24 15.12,3.04 13.65,3.87L10.85,2M18.33,7L16.67,9.5C17.35,9.95 18.29,9.77 18.75,9.08C19.21,8.39 19,7.46 18.33,7Z",
  mdiFan: "M12,11A1,1 0 0,0 11,12A1,1 0 0,0 12,13A1,1 0 0,0 13,12A1,1 0 0,0 12,11M12.5,2C17,2 17.11,5.57 14.75,6.75C13.76,7.24 13.32,8.29 13.13,9.22C13.61,9.42 14.03,9.73 14.35,10.13C18.05,8.13 22.03,8.92 22.03,12.5C22.03,17 18.46,17.1 17.28,14.73C16.78,13.74 15.72,13.3 14.79,13.11C14.59,13.59 14.28,14 13.88,14.34C15.87,18.03 15.08,22 11.5,22C7,22 6.91,18.42 9.27,17.24C10.25,16.75 10.69,15.71 10.89,14.79C10.4,14.59 9.97,14.27 9.65,13.87C5.96,15.85 2,15.07 2,11.5C2,7 5.56,6.89 6.74,9.26C7.24,10.25 8.29,10.68 9.22,10.87C9.41,10.39 9.73,9.97 10.14,9.65C8.15,5.96 8.94,2 12.5,2Z",
  mdiFloorLamp: "M15,2L17,9H7L9,2M11,10H13V20H16V22H8V20H11V10Z",
  mdiGarageVariant: "M22 9V20H20V11H4V20H2V9L12 5L22 9M19 12H5V14H19V12M19 18H5V20H19V18M19 15H5V17H19V15Z",
  mdiLamp: "M8,2H16L20,14H4L8,2M11,15H13V20H18V22H6V20H11V15Z",
  mdiOutdoorLamp: "M15 22H13C11.9 22 11 21.1 11 20V15H17V20C17 21.1 16.1 22 15 22M7 14H21L15 9.71V6C15 4.39 13.94 2 11 2S7 4.39 7 6C7 6.45 6.81 7 6 7H5V3H3V12H5V9H6C8.2 9 9 7.21 9 6C9 5.67 9.1 4 11 4C12.83 4 13 5.54 13 6V9.71L7 14Z",
  mdiPowerSocketUs: "M8,7H10V12H8V7M4.22,2H19.78C21,2 22,3 22,4.22V19.78A2.22,2.22 0 0,1 19.78,22H4.22C3,22 2,21 2,19.78V4.22A2.22,2.22 0 0,1 4.22,2M12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4M14,7.5H16V11.5H14V7.5M10.5,16.25A1.5,1.5 0 0,1 12,14.75A1.5,1.5 0 0,1 13.5,16.25V17H10.5V16.25Z",
  mdiStringLights: "M22.56 11.39C22.36 10.59 21.82 9.85 21.05 9.44L20.63 7.74C21.11 7.58 21.57 7.41 22 7.23V5C20 6.07 16.53 7.03 12 7.03S4 6.07 2 5V7.23C2.43 7.41 2.89 7.58 3.37 7.74L2.95 9.44C2.18 9.85 1.64 10.59 1.44 11.39C.905 13.57 .385 17.31 2.92 17.93C4 18.2 6 17.89 7.27 12.82C7.46 12 7.33 11.12 6.84 10.39L7.26 8.67C8.14 8.81 9.05 8.9 10 8.96V10.74C9.35 11.33 9 12.17 9 13C9 15.24 9.39 19 12 19C13.12 19 15 18.22 15 13C15 12.17 14.65 11.33 14 10.74V8.96C14.95 8.9 15.86 8.81 16.74 8.67L17.16 10.39C16.67 11.12 16.54 12 16.73 12.82C18 17.89 20 18.2 21.08 17.93C23.61 17.31 23.09 13.57 22.56 11.39M5.81 12.47C5.81 12.47 4.74 16.84 3.28 16.5C1.82 16.12 2.9 11.75 2.9 11.75S3.26 10.29 4.71 10.65 5.81 12.47 5.81 12.47M12 17.5C10.5 17.5 10.5 13 10.5 13S10.5 11.5 12 11.5 13.5 13 13.5 13 13.5 17.5 12 17.5M20.72 16.5C19.27 16.84 18.19 12.47 18.19 12.47S17.83 11 19.29 10.65 21.1 11.75 21.1 11.75 22.18 16.12 20.72 16.5Z",
  mdiAccessPointOff: "M20.84 22.73L12.1 14C12.06 14 12.03 14 12 14C10.9 14 10 13.11 10 12C10 11.97 10 11.94 10 11.9L8.4 10.29C8.15 10.81 8 11.38 8 12C8 13.11 8.45 14.11 9.17 14.83L7.76 16.24C6.67 15.15 6 13.65 6 12C6 10.83 6.34 9.74 6.93 8.82L5.5 7.37C4.55 8.67 4 10.27 4 12C4 14.22 4.89 16.22 6.34 17.66L4.93 19.07C3.12 17.26 2 14.76 2 12C2 9.72 2.77 7.63 4.06 5.95L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M15.93 12.73L17.53 14.33C17.83 13.61 18 12.83 18 12C18 10.35 17.33 8.85 16.24 7.76L14.83 9.17C15.55 9.89 16 10.89 16 12C16 12.25 15.97 12.5 15.93 12.73M19.03 15.83L20.5 17.28C21.44 15.75 22 13.94 22 12C22 9.24 20.88 6.74 19.07 4.93L17.66 6.34C19.11 7.78 20 9.79 20 12C20 13.39 19.65 14.7 19.03 15.83Z",
  mdiAccountArrowRight: "M18 16H14V18H18V20L21 17L18 14V16M11 4C8.8 4 7 5.8 7 8S8.8 12 11 12 15 10.2 15 8 13.2 4 11 4M11 14C6.6 14 3 15.8 3 18V20H12.5C12.2 19.2 12 18.4 12 17.5C12 16.3 12.3 15.2 12.9 14.1C12.3 14.1 11.7 14 11 14",
  mdiAlarmLight: "M6,6.9L3.87,4.78L5.28,3.37L7.4,5.5L6,6.9M13,1V4H11V1H13M20.13,4.78L18,6.9L16.6,5.5L18.72,3.37L20.13,4.78M4.5,10.5V12.5H1.5V10.5H4.5M19.5,10.5H22.5V12.5H19.5V10.5M6,20H18A2,2 0 0,1 20,22H4A2,2 0 0,1 6,20M12,5A6,6 0 0,1 18,11V19H6V11A6,6 0 0,1 12,5Z",
  mdiAlertOutline: "M12,2L1,21H23M12,6L19.53,19H4.47M11,10V14H13V10M11,16V18H13V16",
  mdiBatteryAlert: "M13 14H11V8H13M13 18H11V16H13M16.7 4H15V2H9V4H7.3C6.6 4 6 4.6 6 5.3V20.6C6 21.4 6.6 22 7.3 22H16.6C17.3 22 17.9 21.4 17.9 20.7V5.3C18 4.6 17.4 4 16.7 4Z",
  mdiCalendarQuestion: "M6,1V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3H18V1H16V3H8V1H6M5,8H19V19H5V8M12.19,9C11.32,9 10.62,9.2 10.08,9.59C9.56,10 9.3,10.57 9.31,11.36L9.32,11.39H11.25C11.26,11.09 11.35,10.86 11.53,10.7C11.71,10.55 11.93,10.47 12.19,10.47C12.5,10.47 12.76,10.57 12.94,10.75C13.12,10.94 13.2,11.2 13.2,11.5C13.2,11.82 13.13,12.09 12.97,12.32C12.83,12.55 12.62,12.75 12.36,12.91C11.85,13.25 11.5,13.55 11.31,13.82C11.11,14.08 11,14.5 11,15H13C13,14.69 13.04,14.44 13.13,14.26C13.22,14.08 13.39,13.9 13.64,13.74C14.09,13.5 14.46,13.21 14.75,12.81C15.04,12.41 15.19,12 15.19,11.5C15.19,10.74 14.92,10.13 14.38,9.68C13.85,9.23 13.12,9 12.19,9M11,16V18H13V16H11Z",
  mdiCalendarRemove: "M19,19H5V8H19M19,3H18V1H16V3H8V1H6V3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3M9.31,17L11.75,14.56L14.19,17L15.25,15.94L12.81,13.5L15.25,11.06L14.19,10L11.75,12.44L9.31,10L8.25,11.06L10.69,13.5L8.25,15.94L9.31,17Z",
  mdiCctv: "M6.03 12.03L8.03 15.5L5.5 18.68L2 12.62L6.03 12.03M17 18V15.29C17.88 14.9 18.5 14.03 18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L8.31 9C7.36 9.53 7.03 10.75 7.58 11.71L9.08 14.31C9.63 15.26 10.86 15.59 11.81 15.04L13.69 13.96C13.94 14.55 14.41 15.03 15 15.29V18C15 19.1 15.9 20 17 20H22V18H17Z",
  mdiCctvOff: "M20.84 22.73L18.11 20H17C15.9 20 15 19.1 15 18V16.89L12.66 14.55L11.81 15.04C10.86 15.59 9.63 15.26 9.08 14.31L7.58 11.71C7.18 11 7.25 10.18 7.68 9.57L1.11 3L2.39 1.73L22.11 21.46L20.84 22.73M18.5 13C18.5 12.43 18.3 11.9 17.97 11.5L19.94 10.35C20.95 9.76 21.3 8.47 20.71 7.46L19.33 5.06C18.74 4.05 17.45 3.7 16.44 4.28L10.77 7.57L17.86 14.66C18.26 14.22 18.5 13.64 18.5 13M2 12.62L5.5 18.68L8.03 15.5L6.03 12.03L2 12.62Z",
  mdiChartLine: "M16,11.78L20.24,4.45L21.97,5.45L16.74,14.5L10.23,10.75L5.46,19H22V21H2V3H4V17.54L9.5,8L16,11.78Z",
  mdiCheckCircleOutline: "M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M12 20C7.59 20 4 16.41 4 12S7.59 4 12 4 20 7.59 20 12 16.41 20 12 20M16.59 7.58L10 14.17L7.41 11.59L6 13L10 17L18 9L16.59 7.58Z",
  mdiChevronRight: "M8.59,16.58L13.17,12L8.59,7.41L10,6L16,12L10,18L8.59,16.58Z",
  mdiCoachLamp: "M16 5L15 2H13L12 5L6 8H8L8.6 11H4V7H2V17H4V13H9L10 18L12 20L13 22H15L16 20L18 18L20 8H22M16.16 17H11.84L10 8H18Z",
  mdiDumbbell: "M20.57,14.86L22,13.43L20.57,12L17,15.57L8.43,7L12,3.43L10.57,2L9.14,3.43L7.71,2L5.57,4.14L4.14,2.71L2.71,4.14L4.14,5.57L2,7.71L3.43,9.14L2,10.57L3.43,12L7,8.43L15.57,17L12,20.57L13.43,22L14.86,20.57L16.29,22L18.43,19.86L19.86,21.29L21.29,19.86L19.86,18.43L22,16.29L20.57,14.86Z",
  mdiHarddisk: "M6,2H18A2,2 0 0,1 20,4V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V4A2,2 0 0,1 6,2M12,4A6,6 0 0,0 6,10C6,13.31 8.69,16 12.1,16L11.22,13.77C10.95,13.29 11.11,12.68 11.59,12.4L12.45,11.9C12.93,11.63 13.54,11.79 13.82,12.27L15.74,14.69C17.12,13.59 18,11.9 18,10A6,6 0 0,0 12,4M12,9A1,1 0 0,1 13,10A1,1 0 0,1 12,11A1,1 0 0,1 11,10A1,1 0 0,1 12,9M7,18A1,1 0 0,0 6,19A1,1 0 0,0 7,20A1,1 0 0,0 8,19A1,1 0 0,0 7,18M12.09,13.27L14.58,19.58L17.17,18.08L12.95,12.77L12.09,13.27Z",
  mdiHomeAccount: "M12,3L2,12H5V20H19V12H22L12,3M12,8.75A2.25,2.25 0 0,1 14.25,11A2.25,2.25 0 0,1 12,13.25A2.25,2.25 0 0,1 9.75,11A2.25,2.25 0 0,1 12,8.75M12,15C13.5,15 16.5,15.75 16.5,17.25V18H7.5V17.25C7.5,15.75 10.5,15 12,15Z",
  mdiLanDisconnect: "M4,1C2.89,1 2,1.89 2,3V7C2,8.11 2.89,9 4,9H1V11H13V9H10C11.11,9 12,8.11 12,7V3C12,1.89 11.11,1 10,1H4M4,3H10V7H4V3M14,13C12.89,13 12,13.89 12,15V19C12,20.11 12.89,21 14,21H11V23H23V21H20C21.11,21 22,20.11 22,19V15C22,13.89 21.11,13 20,13H14M3.88,13.46L2.46,14.88L4.59,17L2.46,19.12L3.88,20.54L6,18.41L8.12,20.54L9.54,19.12L7.41,17L9.54,14.88L8.12,13.46L6,15.59L3.88,13.46M14,15H20V19H14V15Z",
  mdiLightbulb: "M12,2A7,7 0 0,0 5,9C5,11.38 6.19,13.47 8,14.74V17A1,1 0 0,0 9,18H15A1,1 0 0,0 16,17V14.74C17.81,13.47 19,11.38 19,9A7,7 0 0,0 12,2M9,21A1,1 0 0,0 10,22H14A1,1 0 0,0 15,21V20H9V21Z",
  mdiLightbulbGroup: "M15 14V16A1 1 0 0 1 14 17H10A1 1 0 0 1 9 16V14A5 5 0 1 1 15 14M14 18H10V19A1 1 0 0 0 11 20H13A1 1 0 0 0 14 19M7 19V18H5V19A1 1 0 0 0 6 20H7.17A2.93 2.93 0 0 1 7 19M5 10A6.79 6.79 0 0 1 5.68 7A4 4 0 0 0 4 14.45V16A1 1 0 0 0 5 17H7V14.88A6.92 6.92 0 0 1 5 10M17 18V19A2.93 2.93 0 0 1 16.83 20H18A1 1 0 0 0 19 19V18M18.32 7A6.79 6.79 0 0 1 19 10A6.92 6.92 0 0 1 17 14.88V17H19A1 1 0 0 0 20 16V14.45A4 4 0 0 0 18.32 7Z",
  mdiMenu: "M3,6H21V8H3V6M3,11H21V13H3V11M3,16H21V18H3V16Z",
  mdiPlayCircleOutline: "M12,20C7.59,20 4,16.41 4,12C4,7.59 7.59,4 12,4C16.41,4 20,7.59 20,12C20,16.41 16.41,20 12,20M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M10,16.5L16,12L10,7.5V16.5Z",
  mdiRouterWireless: "M20.2,5.9L21,5.1C19.6,3.7 17.8,3 16,3C14.2,3 12.4,3.7 11,5.1L11.8,5.9C13,4.8 14.5,4.2 16,4.2C17.5,4.2 19,4.8 20.2,5.9M19.3,6.7C18.4,5.8 17.2,5.3 16,5.3C14.8,5.3 13.6,5.8 12.7,6.7L13.5,7.5C14.2,6.8 15.1,6.5 16,6.5C16.9,6.5 17.8,6.8 18.5,7.5L19.3,6.7M19,13H17V9H15V13H5A2,2 0 0,0 3,15V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V15A2,2 0 0,0 19,13M8,18H6V16H8V18M11.5,18H9.5V16H11.5V18M15,18H13V16H15V18Z",
  mdiShieldHome: "M11,13H13V16H16V11H18L12,6L6,11H8V16H11V13M12,1L21,5V11C21,16.55 17.16,21.74 12,23C6.84,21.74 3,16.55 3,11V5L12,1Z",
  mdiSprinklerVariant: "M10 10H14V22H10V10M7 9H9V7H7V9M4 8H6V6H4V8M4 11H6V9H4V11M1 13H3V11H1V13M1 7H3V5H1V7M1 10H3V8H1V10M18 11H20V9H18V11M21 10H23V8H21V10M21 5V7H23V5H21M21 13H23V11H21V13M15 9H17V7H15V9M18 8H20V6H18V8M10 7H10.33L11 9H13L13.67 7H14V6H10V7Z",
  mdiTelevisionClassic: "M8.16,3L6.75,4.41L9.34,7H4C2.89,7 2,7.89 2,9V19C2,20.11 2.89,21 4,21H20C21.11,21 22,20.11 22,19V9C22,7.89 21.11,7 20,7H14.66L17.25,4.41L15.84,3L12,6.84L8.16,3M4,9H17V19H4V9M19.5,9A1,1 0 0,1 20.5,10A1,1 0 0,1 19.5,11A1,1 0 0,1 18.5,10A1,1 0 0,1 19.5,9M19.5,12A1,1 0 0,1 20.5,13A1,1 0 0,1 19.5,14A1,1 0 0,1 18.5,13A1,1 0 0,1 19.5,12Z",
  mdiThermometer: "M15 13V5A3 3 0 0 0 9 5V13A5 5 0 1 0 15 13M12 4A1 1 0 0 1 13 5V8H11V5A1 1 0 0 1 12 4Z",
  mdiUmbrellaOutline: "M12,4C8.9,4 6.18,6.03 5.3,9H18.7C17.82,6.04 15.09,4 12,4M12,2A9,9 0 0,1 21,11H13V19A3,3 0 0,1 10,22A3,3 0 0,1 7,19V18H9V19A1,1 0 0,0 10,20A1,1 0 0,0 11,19V11H3A9,9 0 0,1 12,2Z",
  mdiUpdate: "M21,10.12H14.22L16.96,7.3C14.23,4.6 9.81,4.5 7.08,7.2C4.35,9.91 4.35,14.28 7.08,17C9.81,19.7 14.23,19.7 16.96,17C18.32,15.65 19,14.08 19,12.1H21C21,14.08 20.12,16.65 18.36,18.39C14.85,21.87 9.15,21.87 5.64,18.39C2.14,14.92 2.11,9.28 5.62,5.81C9.13,2.34 14.76,2.34 18.27,5.81L21,3V10.12M12.5,8V12.25L16,14.33L15.28,15.54L11,13V8H12.5Z",
  mdiWeatherCloudy: "M6,19A5,5 0 0,1 1,14A5,5 0 0,1 6,9C7,6.65 9.3,5 12,5C15.43,5 18.24,7.66 18.5,11.03L19,11A4,4 0 0,1 23,15A4,4 0 0,1 19,19H6M19,13H17V12A5,5 0 0,0 12,7C9.5,7 7.45,8.82 7.06,11.19C6.73,11.07 6.37,11 6,11A3,3 0 0,0 3,14A3,3 0 0,0 6,17H19A2,2 0 0,0 21,15A2,2 0 0,0 19,13Z",
  mdiWeatherFog: "M3,15H13A1,1 0 0,1 14,16A1,1 0 0,1 13,17H3A1,1 0 0,1 2,16A1,1 0 0,1 3,15M16,15H21A1,1 0 0,1 22,16A1,1 0 0,1 21,17H16A1,1 0 0,1 15,16A1,1 0 0,1 16,15M1,12A5,5 0 0,1 6,7C7,4.65 9.3,3 12,3C15.43,3 18.24,5.66 18.5,9.03L19,9C21.19,9 22.97,10.76 23,13H21A2,2 0 0,0 19,11H17V10A5,5 0 0,0 12,5C9.5,5 7.45,6.82 7.06,9.19C6.73,9.07 6.37,9 6,9A3,3 0 0,0 3,12C3,12.35 3.06,12.69 3.17,13H1.1L1,12M3,19H5A1,1 0 0,1 6,20A1,1 0 0,1 5,21H3A1,1 0 0,1 2,20A1,1 0 0,1 3,19M8,19H21A1,1 0 0,1 22,20A1,1 0 0,1 21,21H8A1,1 0 0,1 7,20A1,1 0 0,1 8,19Z",
  mdiWeatherHail: "M6,14A1,1 0 0,1 7,15A1,1 0 0,1 6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14M10,18A2,2 0 0,1 12,20A2,2 0 0,1 10,22A2,2 0 0,1 8,20A2,2 0 0,1 10,18M14.5,16A1.5,1.5 0 0,1 16,17.5A1.5,1.5 0 0,1 14.5,19A1.5,1.5 0 0,1 13,17.5A1.5,1.5 0 0,1 14.5,16M10.5,12A1.5,1.5 0 0,1 12,13.5A1.5,1.5 0 0,1 10.5,15A1.5,1.5 0 0,1 9,13.5A1.5,1.5 0 0,1 10.5,12Z",
  mdiWeatherLightning: "M6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14H7A1,1 0 0,1 8,15A1,1 0 0,1 7,16H6M12,11H15L13,15H15L11.25,22L12,17H9.5L12,11Z",
  mdiWeatherLightningRainy: "M4.5,13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.44 4,15.6 3.5,15.33V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16A1,1 0 0,1 18,15A1,1 0 0,1 19,14A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59M9.5,11H12.5L10.5,15H12.5L8.75,22L9.5,17H7L9.5,11M17.5,18.67C17.5,19.96 16.5,21 15.25,21C14,21 13,19.96 13,18.67C13,17.12 15.25,14.5 15.25,14.5C15.25,14.5 17.5,17.12 17.5,18.67Z",
  mdiWeatherNight: "M17.75,4.09L15.22,6.03L16.13,9.09L13.5,7.28L10.87,9.09L11.78,6.03L9.25,4.09L12.44,4L13.5,1L14.56,4L17.75,4.09M21.25,11L19.61,12.25L20.2,14.23L18.5,13.06L16.8,14.23L17.39,12.25L15.75,11L17.81,10.95L18.5,9L19.19,10.95L21.25,11M18.97,15.95C19.8,15.87 20.69,17.05 20.16,17.8C19.84,18.25 19.5,18.67 19.08,19.07C15.17,23 8.84,23 4.94,19.07C1.03,15.17 1.03,8.83 4.94,4.93C5.34,4.53 5.76,4.17 6.21,3.85C6.96,3.32 8.14,4.21 8.06,5.04C7.79,7.9 8.75,10.87 10.95,13.06C13.14,15.26 16.1,16.22 18.97,15.95M17.33,17.97C14.5,17.81 11.7,16.64 9.53,14.5C7.36,12.31 6.2,9.5 6.04,6.68C3.23,9.82 3.34,14.64 6.35,17.66C9.37,20.67 14.19,20.78 17.33,17.97Z",
  mdiWeatherPartlyCloudy: "M12.74,5.47C15.1,6.5 16.35,9.03 15.92,11.46C17.19,12.56 18,14.19 18,16V16.17C18.31,16.06 18.65,16 19,16A3,3 0 0,1 22,19A3,3 0 0,1 19,22H6A4,4 0 0,1 2,18A4,4 0 0,1 6,14H6.27C5,12.45 4.6,10.24 5.5,8.26C6.72,5.5 9.97,4.24 12.74,5.47M11.93,7.3C10.16,6.5 8.09,7.31 7.31,9.07C6.85,10.09 6.93,11.22 7.41,12.13C8.5,10.83 10.16,10 12,10C12.7,10 13.38,10.12 14,10.34C13.94,9.06 13.18,7.86 11.93,7.3M13.55,3.64C13,3.4 12.45,3.23 11.88,3.12L14.37,1.82L15.27,4.71C14.76,4.29 14.19,3.93 13.55,3.64M6.09,4.44C5.6,4.79 5.17,5.19 4.8,5.63L4.91,2.82L7.87,3.5C7.25,3.71 6.65,4.03 6.09,4.44M18,9.71C17.91,9.12 17.78,8.55 17.59,8L19.97,9.5L17.92,11.73C18.03,11.08 18.05,10.4 18,9.71M3.04,11.3C3.11,11.9 3.24,12.47 3.43,13L1.06,11.5L3.1,9.28C3,9.93 2.97,10.61 3.04,11.3M19,18H16V16A4,4 0 0,0 12,12A4,4 0 0,0 8,16H6A2,2 0 0,0 4,18A2,2 0 0,0 6,20H19A1,1 0 0,0 20,19A1,1 0 0,0 19,18Z",
  mdiWeatherPouring: "M9,12C9.53,12.14 9.85,12.69 9.71,13.22L8.41,18.05C8.27,18.59 7.72,18.9 7.19,18.76C6.65,18.62 6.34,18.07 6.5,17.54L7.78,12.71C7.92,12.17 8.47,11.86 9,12M13,12C13.53,12.14 13.85,12.69 13.71,13.22L11.64,20.95C11.5,21.5 10.95,21.8 10.41,21.66C9.88,21.5 9.56,20.97 9.7,20.43L11.78,12.71C11.92,12.17 12.47,11.86 13,12M17,12C17.53,12.14 17.85,12.69 17.71,13.22L16.41,18.05C16.27,18.59 15.72,18.9 15.19,18.76C14.65,18.62 14.34,18.07 14.5,17.54L15.78,12.71C15.92,12.17 16.47,11.86 17,12M17,10V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,12.11 3.6,13.08 4.5,13.6V13.59C5,13.87 5.14,14.5 4.87,14.96C4.59,15.43 4,15.6 3.5,15.32V15.33C2,14.47 1,12.85 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12C23,13.5 22.2,14.77 21,15.46V15.46C20.5,15.73 19.91,15.57 19.63,15.09C19.36,14.61 19.5,14 20,13.72V13.73C20.6,13.39 21,12.74 21,12A2,2 0 0,0 19,10H17Z",
  mdiWeatherRainy: "M6,14.03A1,1 0 0,1 7,15.03C7,15.58 6.55,16.03 6,16.03C3.24,16.03 1,13.79 1,11.03C1,8.27 3.24,6.03 6,6.03C7,3.68 9.3,2.03 12,2.03C15.43,2.03 18.24,4.69 18.5,8.06L19,8.03A4,4 0 0,1 23,12.03C23,14.23 21.21,16.03 19,16.03H18C17.45,16.03 17,15.58 17,15.03C17,14.47 17.45,14.03 18,14.03H19A2,2 0 0,0 21,12.03A2,2 0 0,0 19,10.03H17V9.03C17,6.27 14.76,4.03 12,4.03C9.5,4.03 7.45,5.84 7.06,8.21C6.73,8.09 6.37,8.03 6,8.03A3,3 0 0,0 3,11.03A3,3 0 0,0 6,14.03M12,14.15C12.18,14.39 12.37,14.66 12.56,14.94C13,15.56 14,17.03 14,18C14,19.11 13.1,20 12,20A2,2 0 0,1 10,18C10,17.03 11,15.56 11.44,14.94C11.63,14.66 11.82,14.4 12,14.15M12,11.03L11.5,11.59C11.5,11.59 10.65,12.55 9.79,13.81C8.93,15.06 8,16.56 8,18A4,4 0 0,0 12,22A4,4 0 0,0 16,18C16,16.56 15.07,15.06 14.21,13.81C13.35,12.55 12.5,11.59 12.5,11.59",
  mdiWeatherSnowy: "M6,14A1,1 0 0,1 7,15A1,1 0 0,1 6,16A5,5 0 0,1 1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16H18A1,1 0 0,1 17,15A1,1 0 0,1 18,14H19A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11A3,3 0 0,0 6,14M7.88,18.07L10.07,17.5L8.46,15.88C8.07,15.5 8.07,14.86 8.46,14.46C8.85,14.07 9.5,14.07 9.88,14.46L11.5,16.07L12.07,13.88C12.21,13.34 12.76,13.03 13.29,13.17C13.83,13.31 14.14,13.86 14,14.4L13.41,16.59L15.6,16C16.14,15.86 16.69,16.17 16.83,16.71C16.97,17.24 16.66,17.79 16.12,17.93L13.93,18.5L15.54,20.12C15.93,20.5 15.93,21.15 15.54,21.54C15.15,21.93 14.5,21.93 14.12,21.54L12.5,19.93L11.93,22.12C11.79,22.66 11.24,22.97 10.71,22.83C10.17,22.69 9.86,22.14 10,21.6L10.59,19.41L8.4,20C7.86,20.14 7.31,19.83 7.17,19.29C7.03,18.76 7.34,18.21 7.88,18.07Z",
  mdiWeatherSnowyRainy: "M18.5,18.67C18.5,19.96 17.5,21 16.25,21C15,21 14,19.96 14,18.67C14,17.12 16.25,14.5 16.25,14.5C16.25,14.5 18.5,17.12 18.5,18.67M4,17.36C3.86,16.82 4.18,16.25 4.73,16.11L7,15.5L5.33,13.86C4.93,13.46 4.93,12.81 5.33,12.4C5.73,12 6.4,12 6.79,12.4L8.45,14.05L9.04,11.8C9.18,11.24 9.75,10.92 10.29,11.07C10.85,11.21 11.17,11.78 11,12.33L10.42,14.58L12.67,14C13.22,13.83 13.79,14.15 13.93,14.71C14.08,15.25 13.76,15.82 13.2,15.96L10.95,16.55L12.6,18.21C13,18.6 13,19.27 12.6,19.67C12.2,20.07 11.54,20.07 11.15,19.67L9.5,18L8.89,20.27C8.75,20.83 8.18,21.14 7.64,21C7.08,20.86 6.77,20.29 6.91,19.74L7.5,17.5L5.26,18.09C4.71,18.23 4.14,17.92 4,17.36M1,11A5,5 0 0,1 6,6C7,3.65 9.3,2 12,2C15.43,2 18.24,4.66 18.5,8.03L19,8A4,4 0 0,1 23,12A4,4 0 0,1 19,16A1,1 0 0,1 18,15A1,1 0 0,1 19,14A2,2 0 0,0 21,12A2,2 0 0,0 19,10H17V9A5,5 0 0,0 12,4C9.5,4 7.45,5.82 7.06,8.19C6.73,8.07 6.37,8 6,8A3,3 0 0,0 3,11C3,11.85 3.35,12.61 3.91,13.16C4.27,13.55 4.26,14.16 3.88,14.54C3.5,14.93 2.85,14.93 2.47,14.54C1.56,13.63 1,12.38 1,11Z",
  mdiWeatherSunny: "M12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M3.36,17L5.12,13.23C5.26,14 5.53,14.78 5.95,15.5C6.37,16.24 6.91,16.86 7.5,17.37L3.36,17M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7M20.64,17L16.5,17.36C17.09,16.85 17.62,16.22 18.04,15.5C18.46,14.77 18.73,14 18.87,13.21L20.64,17M12,22L9.59,18.56C10.33,18.83 11.14,19 12,19C12.82,19 13.63,18.83 14.37,18.56L12,22Z",
  mdiWeatherSunset: "M3,12H7A5,5 0 0,1 12,7A5,5 0 0,1 17,12H21A1,1 0 0,1 22,13A1,1 0 0,1 21,14H3A1,1 0 0,1 2,13A1,1 0 0,1 3,12M5,16H19A1,1 0 0,1 20,17A1,1 0 0,1 19,18H5A1,1 0 0,1 4,17A1,1 0 0,1 5,16M17,20A1,1 0 0,1 18,21A1,1 0 0,1 17,22H7A1,1 0 0,1 6,21A1,1 0 0,1 7,20H17M15,12A3,3 0 0,0 12,9A3,3 0 0,0 9,12H15M12,2L14.39,5.42C13.65,5.15 12.84,5 12,5C11.16,5 10.35,5.15 9.61,5.42L12,2M3.34,7L7.5,6.65C6.9,7.16 6.36,7.78 5.94,8.5C5.5,9.24 5.25,10 5.11,10.79L3.34,7M20.65,7L18.88,10.79C18.74,10 18.47,9.23 18.05,8.5C17.63,7.78 17.1,7.15 16.5,6.64L20.65,7Z",
  mdiWeatherWindy: "M4,10A1,1 0 0,1 3,9A1,1 0 0,1 4,8H12A2,2 0 0,0 14,6A2,2 0 0,0 12,4C11.45,4 10.95,4.22 10.59,4.59C10.2,5 9.56,5 9.17,4.59C8.78,4.2 8.78,3.56 9.17,3.17C9.9,2.45 10.9,2 12,2A4,4 0 0,1 16,6A4,4 0 0,1 12,10H4M19,12A1,1 0 0,0 20,11A1,1 0 0,0 19,10C18.72,10 18.47,10.11 18.29,10.29C17.9,10.68 17.27,10.68 16.88,10.29C16.5,9.9 16.5,9.27 16.88,8.88C17.42,8.34 18.17,8 19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14H5A1,1 0 0,1 4,13A1,1 0 0,1 5,12H19M18,18H4A1,1 0 0,1 3,17A1,1 0 0,1 4,16H18A3,3 0 0,1 21,19A3,3 0 0,1 18,22C17.17,22 16.42,21.66 15.88,21.12C15.5,20.73 15.5,20.1 15.88,19.71C16.27,19.32 16.9,19.32 17.29,19.71C17.47,19.89 17.72,20 18,20A1,1 0 0,0 19,19A1,1 0 0,0 18,18Z",
  mdiWebOff: "M9.4 4.44C9.19 4.83 9 5.23 8.84 5.64L10.37 7.17C10.78 6.05 11.33 5 12 4.03C12.83 5.23 13.5 6.57 13.91 8H11.2L13.2 10H14.34C14.4 10.41 14.44 10.84 14.47 11.27L16.44 13.24C16.47 12.83 16.5 12.42 16.5 12C16.5 11.32 16.44 10.66 16.36 10H19.74C19.9 10.64 20 11.31 20 12S19.9 13.36 19.74 14H17.2L20.5 17.28C21.44 15.75 22 13.94 22 12C22 6.5 17.5 2 12 2C10.06 2 8.25 2.56 6.72 3.5L8.18 5C8.57 4.77 9 4.58 9.4 4.44M18.92 8H15.97C15.65 6.75 15.19 5.55 14.59 4.44C16.43 5.07 17.96 6.34 18.92 8M2.39 1.73L1.11 3L4.06 5.95C2.77 7.63 2 9.73 2 12C2 17.5 6.5 22 12 22C14.28 22 16.37 21.23 18.06 19.95L20.84 22.73L22.11 21.46L2.39 1.73M5.5 7.37L6.11 8H5.08C5.2 7.78 5.34 7.58 5.5 7.37M4.26 14C4.1 13.36 4 12.69 4 12S4.1 10.64 4.26 10H7.64C7.56 10.66 7.5 11.32 7.5 12S7.56 13.34 7.64 14H4.26M5.08 16H8C8.35 17.25 8.8 18.45 9.4 19.56C7.57 18.93 6.03 17.65 5.08 16M9.5 12C9.5 11.8 9.5 11.61 9.53 11.42L12.11 14H9.66C9.56 13.34 9.5 12.68 9.5 12M12 19.96C11.17 18.76 10.5 17.43 10.09 16H13.91C13.5 17.43 12.83 18.76 12 19.96M14.59 19.56C14.96 18.88 15.26 18.15 15.5 17.41L16.62 18.5C16 18.95 15.32 19.31 14.59 19.56Z",
};

const ALARM_SOUNDS = ["fire_alarm", "scream", "yell"];
const RAIN = new Set(["rainy", "pouring", "lightning-rainy", "snowy-rainy", "hail", "snowy"]);
const LONG_OFFLINE_MS = 7 * 864e5;
// Icons a lights/switches entry may name in config (anything else falls back to a bulb).
const SWITCH_ICONS = ["mdiLightbulb", "mdiLamp", "mdiFloorLamp", "mdiDeskLamp", "mdiCeilingLight", "mdiCoachLamp", "mdiOutdoorLamp", "mdiGarageVariant", "mdiStringLights", "mdiFan", "mdiPowerSocketUs"];

const svg = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="${ICONS[name] || ""}"/></svg>`;
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const live = (st) => !!st && !["unavailable", "unknown"].includes(st.state);
const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : null;
};
const nice = (s) => String(s).replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
const startOfDay = (ms) => new Date(ms).setHours(0, 0, 0, 0);
const localDate = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dayLabel(ms) {
  const diff = Math.round((startOfDay(ms) - startOfDay(Date.now())) / 864e5);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff > 1 && diff < 7) return new Date(ms).toLocaleDateString([], { weekday: "long" });
  return new Date(ms).toLocaleDateString([], { month: "short", day: "numeric" });
}

const CONDITION = {
  "clear-night": ["Clear", "mdiWeatherNight"], cloudy: ["Cloudy", "mdiWeatherCloudy"], fog: ["Fog", "mdiWeatherFog"],
  hail: ["Hail", "mdiWeatherHail"], lightning: ["Storms", "mdiWeatherLightning"], "lightning-rainy": ["Storms", "mdiWeatherLightningRainy"],
  partlycloudy: ["Partly cloudy", "mdiWeatherPartlyCloudy"], pouring: ["Heavy rain", "mdiWeatherPouring"], rainy: ["Rain", "mdiWeatherRainy"],
  snowy: ["Snow", "mdiWeatherSnowy"], "snowy-rainy": ["Sleet", "mdiWeatherSnowyRainy"], sunny: ["Sunny", "mdiWeatherSunny"],
  windy: ["Windy", "mdiWeatherWindy"], "windy-variant": ["Windy", "mdiWeatherWindy"], exceptional: ["Severe weather", "mdiAlertOutline"],
};

const CSS = `
:host {
  --bg: #080d17; --card: #0f1624; --card-2: #141d2e; --line: rgba(148,170,200,.12);
  --text: #eef3fa; --muted: #8593a8; --gold: #fcd34d; --gold-2: #d97706;
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
.app { max-width: 1480px; margin: 0 auto; padding: 28px 28px 40px; }

.top { display: flex; align-items: center; gap: 18px; margin-bottom: 24px; flex-wrap: wrap; }
.icon-btn { width: 48px; height: 48px; border-radius: 16px; display: grid; place-items: center; background: var(--card-2); border: 1px solid var(--line); flex: none; }
.hello { flex: 1 1 320px; min-width: 0; }
.hello .date { font-size: 15px; color: var(--muted); }
h1 { margin: 2px 0 0; font-size: 34px; font-weight: 700; line-height: 1.1; }
.status { display: flex; align-items: center; gap: 8px; margin-top: 8px; font-size: 18px; flex-wrap: wrap; }
.status b { font-weight: 600; }
.status a, .status button.lnk { color: inherit; }
.dot { width: 12px; height: 12px; border-radius: 50%; flex: none; background: var(--grey); }
.dot.green { background: var(--green); box-shadow: 0 0 10px var(--green); }
.dot.amber { background: var(--amber); box-shadow: 0 0 10px var(--amber); }
.dot.red { background: var(--red); box-shadow: 0 0 10px var(--red); animation: pulse 1.2s ease-in-out infinite; }
.dot.blue { background: var(--blue); box-shadow: 0 0 10px var(--blue); animation: pulse 1.6s ease-in-out infinite; }
@keyframes pulse { 50% { opacity: .35; } }
.chip { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 11px; border-radius: 10px; font-size: 14px; font-weight: 500; background: #172234; border: 1px solid var(--line); color: #c3cedd; }
.chip .ic { width: 17px; height: 17px; }
.weather { display: flex; align-items: center; gap: 16px; padding: 14px 20px; border-radius: 22px; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); }
.weather > .ic { width: 46px; height: 46px; color: var(--gold); }
.weather .temp { font-size: 40px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.weather .cond { font-size: 15px; color: #c3cedd; }
.weather .hl { font-size: 13.5px; color: var(--muted); margin-top: 2px; }

.tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; margin-bottom: 22px; }
.tile { border-radius: 22px; padding: 16px 16px 14px; background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1.5px solid var(--line); min-width: 0; display: flex; flex-direction: column; gap: 10px; min-height: 128px; transition: border-color .2s; }
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
.tile-go { width: 18px; height: 18px; color: #4b5a70; }
.tile-state { font-size: 20px; font-weight: 600; line-height: 1.2; overflow-wrap: anywhere; }
.tile-sub { font-size: 14px; color: var(--muted); line-height: 1.35; overflow-wrap: anywhere; margin-top: -4px; }

.grid { display: grid; gap: 22px; align-items: start; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); grid-template-areas: "lights agenda" "attn agenda"; }
.grid.urgent { grid-template-areas: "attn agenda" "lights agenda"; }
.card { background: linear-gradient(180deg, var(--card-2), var(--card)); border: 1px solid var(--line); border-radius: 28px; padding: 22px 24px; min-width: 0; }
.a-lights { grid-area: lights; } .a-agenda { grid-area: agenda; } .a-attn { grid-area: attn; }
.eyebrow { font-size: 13px; letter-spacing: .12em; font-weight: 600; color: var(--muted); text-transform: uppercase; }
.head { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; }

.switches { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; margin-top: 14px; }
.sw { border-radius: 18px; padding: 14px; background: #121a28; border: 1.5px solid var(--line); display: flex; flex-direction: column; gap: 12px; min-width: 0; min-height: 104px; transition: background .2s, border-color .2s; }
.sw .sic { width: 40px; height: 40px; border-radius: 13px; display: grid; place-items: center; background: #243246; color: #aeb9c9; }
.sw.on { background: #231d10; border-color: rgba(252,211,77,.45); }
.sw.on .sic { background: linear-gradient(160deg, #fde68a, var(--gold-2)); color: #3b2604; box-shadow: 0 6px 18px rgba(217,119,6,.35); }
.sw b { font-size: 16px; font-weight: 600; display: block; overflow-wrap: anywhere; }
.sw span { font-size: 13px; color: var(--muted); }
.sw.on span { color: #f7d49a; }
.sw:disabled { opacity: .45; }

.agenda { margin-top: 12px; display: flex; flex-direction: column; }
.ag { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 12px; align-items: center; padding: 11px 0; border-top: 1px solid var(--line); }
.ag:first-child { border-top: 0; }
.ag .aic { width: 40px; height: 40px; border-radius: 12px; display: grid; place-items: center; background: #172234; color: #c3cedd; }
.ag .aic .ic { width: 21px; height: 21px; }
.ag b { font-size: 16px; font-weight: 500; display: block; overflow-wrap: anywhere; }
.ag small { font-size: 13px; color: var(--muted); }
.ag .when { text-align: right; font-size: 14px; font-weight: 600; white-space: nowrap; }
.ag .when small { display: block; font-weight: 400; }
button.ag { width: 100%; }

.items { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; }
.item { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; border-radius: 16px; background: #121a28; border: 1px solid var(--line); line-height: 1.4; width: 100%; }
.item > .ic { width: 22px; height: 22px; margin-top: 1px; }
.item b { font-weight: 600; display: block; font-size: 16px; }
.item span { font-size: 14px; color: var(--muted); }
.item.red { border-color: rgba(240,97,109,.4); } .item.red > .ic { color: var(--red); }
.item.amber { border-color: rgba(245,176,65,.3); } .item.amber > .ic { color: var(--amber); }
.item.info > .ic { color: var(--blue); }
.item .go { margin-left: auto; width: 18px; height: 18px; color: #4b5a70; align-self: center; }
.allgood { display: flex; gap: 12px; align-items: center; margin-top: 14px; font-size: 16px; color: #b9f2cc; }
.allgood .ic { color: var(--green); }
.link { margin-top: 10px; color: var(--gold); font-weight: 600; font-size: 15px; }
.toast { position: fixed; left: 50%; bottom: 28px; transform: translateX(-50%); padding: 14px 20px; border-radius: 14px; background: #3a1d24; border: 1px solid rgba(240,97,109,.5); color: #ffd3d7; z-index: 10; max-width: 90vw; }

@container (max-width: 1100px) { .tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
@container (max-width: 900px) {
  .grid, .grid.urgent { grid-template-columns: minmax(0, 1fr); grid-template-areas: "lights" "agenda" "attn"; }
  .grid.urgent { grid-template-areas: "attn" "lights" "agenda"; }
}
@container (max-width: 640px) {
  .app { padding: 14px 14px 24px; }
  .top { gap: 12px; margin-bottom: 14px; }
  .icon-btn { width: 44px; height: 44px; border-radius: 14px; }
  h1 { font-size: 24px; }
  .status { font-size: 15px; margin-top: 6px; }
  .weather { width: 100%; padding: 12px 14px; border-radius: 18px; }
  .weather > .ic { width: 36px; height: 36px; } .weather .temp { font-size: 30px; }
  .tiles { gap: 10px; margin-bottom: 14px; }
  .tile { padding: 12px; border-radius: 18px; min-height: 112px; gap: 8px; }
  .tic { width: 34px; height: 34px; border-radius: 11px; } .tic .ic { width: 19px; height: 19px; }
  .tile-name { font-size: 12.5px; } .tile-state { font-size: 16px; } .tile-sub { font-size: 12.5px; }
  .grid { gap: 14px; }
  .card { border-radius: 22px; padding: 16px 14px; }
  .switches { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .sw { padding: 12px; min-height: 96px; border-radius: 16px; }
  .sw b { font-size: 15px; }
  .ag b { font-size: 15px; } .ag .when { font-size: 13px; }
}
`;

class HomePanel extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._html = "";
    this._forecast = null;
    this._toast = "";
    this._showAllAttn = false;
    this.shadowRoot.addEventListener("click", (e) => this._onClick(e));
  }

  set hass(hass) {
    this._hass = hass;
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
    this._subscribe();
    this._scheduleRender();
  }

  disconnectedCallback() {
    clearInterval(this._tick);
    this._unsub?.();
    this._unsub = null;
    this._subscribing = false;
  }

  get _c() {
    return { weather: "weather.home", lights: [], climate: [], cameras: [], links: {}, ...(this._cfg || {}) };
  }

  _subscribe() {
    const w = this._c.weather;
    if (!this._hass || !this.isConnected || this._unsub || this._subscribing || !this._hass.states[w]) return;
    this._subscribing = true;
    this._hass.connection
      .subscribeMessage((m) => {
        this._forecast = m.forecast || [];
        this._scheduleRender();
      }, { type: "weather/subscribe_forecast", forecast_type: "daily", entity_id: w })
      .then((u) => (this._subscribing ? (this._unsub = u) : u()))
      .catch(() => {})
      .finally(() => (this._subscribing = false));
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

  _showToast(msg) {
    this._toast = msg;
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
    else if (a === "more-attn") {
      this._showAllAttn = !this._showAllAttn;
      this._render();
    } else if (a === "toggle") {
      const id = el.dataset.entity;
      const domain = id.split(".")[0];
      try {
        await this._hass.callService(domain === "light" ? "light" : "homeassistant", "toggle", { entity_id: id });
      } catch (err) {
        this._showToast(`Couldn't toggle ${id}: ${err.message || err}`);
      }
    }
  }

  _fmtTime(ms) {
    const tf = this._hass?.locale?.time_format;
    const hour12 = tf === "12" ? true : tf === "24" ? false : undefined;
    return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", hour12 });
  }

  _when(ms) {
    return `${dayLabel(ms)} ${this._fmtTime(ms)}`;
  }

  // ---- domain reads: each returns { level, state, sub } plus attention items ----

  _security(attn) {
    const st = this._hass.states;
    const cams = this._c.cameras;
    if (!cams.length) return null;
    const name = (id) => nice(id);
    const alarms = cams.flatMap((c) => ALARM_SOUNDS.filter((s) => st[`binary_sensor.${c}_${s}_sound`]?.state === "on").map((s) => ({ kind: nice(s), cam: name(c) })));
    const offline = cams.filter((c) => st[`camera.${c}`] && !live(st[`camera.${c}`]));
    const people = cams.filter((c) => st[`binary_sensor.${c}_person_occupancy`]?.state === "on");
    const gaps = cams.filter(
      (c) => st[`binary_sensor.${c}_stream_active`]?.state === "off" || st[`switch.${c}_recordings`]?.state === "off" || st[`switch.${c}_detect`]?.state === "off",
    );
    const go = this._c.links.security;
    if (alarms.length) attn.push({ level: "red", icon: "mdiAlarmLight", title: `${alarms[0].kind} detected · ${alarms[0].cam}`, text: "Open Security to see the camera.", go });
    for (const c of offline) attn.push({ level: "red", icon: "mdiCctvOff", title: `${name(c)} camera is offline`, text: "Nothing is being watched or recorded there.", go });
    for (const c of gaps) attn.push({ level: "amber", icon: "mdiCctv", title: `${name(c)} camera isn't fully watching`, text: "Video, recording or detection is switched off.", go });
    if (alarms.length) return { level: "red", state: `${alarms[0].kind} · ${alarms[0].cam}`, sub: "Alarm sound heard" };
    if (offline.length) return { level: "red", state: `${plural(offline.length, "camera")} offline`, sub: offline.map(name).join(", ") };
    if (people.length) return { level: "blue", state: `Person in ${name(people[0])}`, sub: people.length > 1 ? `Also ${people.slice(1).map(name).join(", ")}` : "Right now" };
    if (gaps.length) return { level: "amber", state: "Not fully watching", sub: gaps.map(name).join(", ") };
    return { level: "green", state: "All clear", sub: `${plural(cams.length, "camera")} watching` };
  }

  _climate() {
    const st = this._hass.states;
    const rooms = this._c.climate
      .map((r) => ({ name: r.name, t: live(st[r.temperature]) ? num(st[r.temperature].state) : null, h: live(st[r.humidity]) ? num(st[r.humidity].state) : null }))
      .filter((r) => r.t !== null);
    if (!rooms.length) return { level: "", state: "No readings", sub: "Thermometers unavailable" };
    return {
      level: "",
      state: rooms.map((r) => `${r.name} ${Math.round(r.t)}°`).join(" · "),
      sub: rooms.filter((r) => r.h !== null).map((r) => `${r.name} ${Math.round(r.h)}% humidity`).join(" · "),
    };
  }

  _lights() {
    const st = this._hass.states;
    const on = this._c.lights.filter((l) => st[l.entity]?.state === "on");
    return {
      level: on.length ? "gold" : "",
      state: on.length ? `${on.length} on` : "All off",
      sub: on.length ? on.map((l) => l.name).join(", ") : `${plural(this._c.lights.length, "light")} and switches`,
      on,
    };
  }

  _media() {
    const st = this._hass.states;
    const players = (this._c.media || []).map((m) => ({ ...m, s: st[m.entity] })).filter((m) => m.s);
    const playing = players.filter((m) => m.s.state === "playing");
    if (playing.length) {
      const m = playing[0];
      const what = m.s.attributes.media_title || m.s.attributes.app_name || "Playing";
      return { level: "blue", state: what, sub: `${m.name}${playing.length > 1 ? ` +${playing.length - 1}` : ""}` };
    }
    const paused = players.find((m) => m.s.state === "paused");
    if (paused) return { level: "", state: "Paused", sub: paused.name };
    return { level: "", state: "Nothing playing", sub: players.length ? players.map((m) => m.name).join(" · ") : "" };
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
    for (const q of upcoming.slice(0, 2)) agenda.push({ at: q.at, icon: "mdiTelevisionClassic", title: "Recording", sub: q.title, go });
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
    const retired = c.retired || [];
    const offline = (devices || [])
      .filter((d) => d.state !== "ONLINE" && !retired.includes(d.id))
      .map((d) => {
        const hb = st[(c.stats || {})[d.id]]?.attributes?.lastHeartbeatAt;
        return { ...d, hb, long: !!hb && Date.now() - Date.parse(hb) > LONG_OFFLINE_MS };
      });
    for (const d of offline) {
      const { hb, long } = d;
      attn.push({
        level: long ? "info" : "amber",
        icon: "mdiAccessPointOff",
        title: `${d.name} access point offline`,
        text: hb ? `Last seen ${new Date(Date.parse(hb)).toLocaleDateString([], { month: "short", day: "numeric" })}.${long ? " Mark it retired if it's gone for good." : ""}` : "Not responding.",
        go,
      });
    }
    if (devs && !devices) attn.push({ level: "info", icon: "mdiLanDisconnect", title: "Wi-Fi details unavailable", text: "HA can't read the UniFi Network app right now; the internet itself is checked separately.", go });
    if (!ok.length) {
      attn.push({ level: "red", icon: "mdiWebOff", title: "Internet is down", text: `No replies from ${lat.map((l) => l.label).join(" or ")}.`, go });
      return { level: "red", state: "Internet down", sub: "No ping replies" };
    }
    if (best > 100) return { level: "amber", state: "Internet slow", sub: `${Math.round(best)} ms` };
    const recentOffline = offline.filter((d) => !d.long);
    if (recentOffline.length) return { level: "amber", state: "Wi-Fi degraded", sub: `${recentOffline.map((d) => d.name).join(", ")} offline` };
    return { level: "green", state: "Internet OK", sub: `${Math.round(best)} ms${devices ? ` · ${devices.filter((d) => d.state === "ONLINE").length} devices up` : " · Wi-Fi details unavailable"}` };
  }

  _coaching(agenda) {
    const st = this._hass.states[this._c.coaching];
    if (!st) return null;
    const a = st.attributes || {};
    const types = { heavy_1h: "1h Heavy", light_30m: "30m Light", shoulder_pt: "PT Day" };
    const go = this._c.links.coaching;
    // Weekly report email: host cron, Mondays 9:00.
    const d = new Date();
    d.setHours(9, 0, 0, 0);
    let days = (8 - d.getDay()) % 7; // until Monday
    if (days === 0 && Date.now() > d.getTime()) days = 7;
    d.setDate(d.getDate() + days);
    agenda.push({ at: d.getTime(), icon: "mdiChartLine", title: "Coaching report email", sub: "Weekly, automatic", go });
    let pending = null;
    try {
      pending = JSON.parse(this._hass.states["input_text.coach_panel_state"]?.state || "{}").l;
    } catch (_) {
      /* no request recorded */
    }
    const gen = a.generated_at ? Date.parse(a.generated_at) : 0;
    if (pending?.at && pending.at * 1000 > gen && Date.now() - pending.at * 1000 < 3600e3)
      return { level: "blue", state: "Generating…", sub: `${types[pending.t] || pending.t} session` };
    if (a.session_date === localDate()) return { level: "green", state: "Session ready", sub: `${types[a.session_type] || a.session_type || ""} · in Hevy` };
    if (!a.session_date) return { level: "", state: "No session yet", sub: "" };
    const [y, m, dd] = a.session_date.split("-").map(Number);
    const ago = Math.round((startOfDay(Date.now()) - new Date(y, m - 1, dd).getTime()) / 864e5);
    return { level: "", state: "No session today", sub: ago === 1 ? "Last one yesterday" : `Last one ${ago} days ago` };
  }

  _general(attn) {
    const st = this._hass.states;
    const updates = Object.values(st).filter((s) => s.entity_id?.startsWith("update.") && s.state === "on");
    if (updates.length)
      attn.push({
        level: "info",
        icon: "mdiUpdate",
        title: `${plural(updates.length, "update")} available`,
        text: updates.map((u) => (u.attributes.friendly_name || u.entity_id).replace(/ (Firmware|update)$/i, "")).join(", "),
        go: "/config/updates",
      });
    const lowBatt = Object.values(st).filter((s) => s.attributes?.device_class === "battery" && s.entity_id?.startsWith("sensor.") && num(s.state) !== null && num(s.state) < 20);
    for (const b of lowBatt) attn.push({ level: "amber", icon: "mdiBatteryAlert", title: `${(b.attributes.friendly_name || b.entity_id).replace(/ battery( level)?$/i, "")} battery low`, text: `${Math.round(num(b.state))}% left.` });
  }

  _sun(agenda) {
    const st = this._hass.states;
    const sun = st["sun.sun"]?.attributes || {};
    const set = sun.next_setting ? Date.parse(sun.next_setting) : null;
    if (set) {
      const yard = st["automation.front_yard_lights_on_at_sunset"]?.state === "on";
      agenda.push({ at: set, icon: "mdiWeatherSunset", title: "Sunset", sub: yard ? "Yard lights turn on" : "" });
    }
    if (st["automation.front_yard_lights_off_at_21_00"]?.state === "on") {
      const d = new Date();
      d.setHours(21, 0, 0, 0);
      if (d.getTime() < Date.now()) d.setDate(d.getDate() + 1);
      agenda.push({ at: d.getTime(), icon: "mdiCoachLamp", title: "Yard lights off", sub: "Automation" });
    }
  }

  _weather(agenda) {
    const st = this._hass.states[this._c.weather];
    if (!live(st)) return null;
    const a = st.attributes || {};
    let cond = st.state;
    // Open-Meteo reports "sunny" after dark; follow the sun instead.
    if (cond === "sunny" && this._hass.states["sun.sun"]?.state === "below_horizon") cond = "clear-night";
    const [label, icon] = CONDITION[cond] || [nice(cond), "mdiWeatherPartlyCloudy"];
    const f = this._forecast || [];
    const today = f.find((d) => startOfDay(Date.parse(d.datetime)) === startOfDay(Date.now())) || f[0];
    const rain = f.slice(0, 7).find((d) => RAIN.has(d.condition) || (d.precipitation_probability ?? 0) >= 50);
    if (rain) agenda.push({ at: Math.max(Date.now() + 1, startOfDay(Date.parse(rain.datetime)) + 8 * 3600e3), icon: "mdiWeatherRainy", title: "Rain expected", sub: CONDITION[rain.condition]?.[0] || "", allDay: true });
    return { temp: num(a.temperature), unit: a.temperature_unit || "°", label, icon, hi: num(today?.temperature), lo: num(today?.templow) };
  }

  _render() {
    if (!this._hass) return;
    const c = this._c;
    const st = this._hass.states;
    const attn = [];
    const agenda = [];
    const L = c.links;

    const tiles = [
      { name: "Security", icon: "mdiShieldHome", go: L.security, ...(this._security(attn) || { level: "", state: "—", sub: "" }) },
      { name: "Climate", icon: "mdiThermometer", ...this._climate() },
      { name: "Lights", icon: "mdiLightbulbGroup", scroll: ".a-lights", ...this._lights() },
      { name: "Media", icon: "mdiPlayCircleOutline", go: L.media, ...this._media() },
      { name: "Irrigation", icon: "mdiSprinklerVariant", go: L.irrigation, ...(this._irrigation(attn, agenda) || { level: "", state: "—", sub: "" }) },
      { name: "Recordings", icon: "mdiTelevisionClassic", go: L.recordings, ...(this._recordings(attn, agenda) || { level: "", state: "—", sub: "" }) },
      { name: "Network", icon: "mdiRouterWireless", go: L.network, ...(this._network(attn) || { level: "", state: "—", sub: "" }) },
      { name: "Coaching", icon: "mdiDumbbell", go: L.coaching, ...(this._coaching(agenda) || { level: "", state: "—", sub: "" }) },
    ];
    this._general(attn);
    this._sun(agenda);
    const weather = this._weather(agenda);

    const order = { red: 0, amber: 1, info: 2 };
    attn.sort((a, b) => order[a.level] - order[b.level]);
    const urgent = attn.filter((i) => i.level === "red");
    const needs = attn.filter((i) => i.level === "red" || i.level === "amber");

    const person = st[c.person];
    const rawName = (person?.attributes?.friendly_name || this._hass.user?.name || "").split(" ")[0];
    const userName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    const h = new Date().getHours();
    const greet = h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
    const dateStr = new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
    const status = urgent.length
      ? { dot: "red", text: `${urgent[0].title}` }
      : needs.length
        ? { dot: "amber", text: `${plural(needs.length, "thing")} need${needs.length === 1 ? "s" : ""} attention` }
        : { dot: "green", text: "All good at home" };
    const presence = person ? (person.state === "home" ? "Home" : person.state === "not_home" ? "Away" : nice(person.state)) : null;

    const header = `
      <header class="top">
        ${this._narrow ? `<button class="icon-btn" data-action="menu" aria-label="Menu">${svg("mdiMenu")}</button>` : ""}
        <div class="hello">
          <div class="date">${esc(dateStr)}</div>
          <h1>${esc(greet)}${userName ? `, ${esc(userName)}` : ""}</h1>
          <div class="status"><span class="dot ${status.dot}"></span>
            ${needs.length ? `<button class="lnk" data-action="scroll" data-target=".a-attn"><b>${esc(status.text)}</b></button>` : `<b>${esc(status.text)}</b>`}
            ${presence ? `<span class="chip">${svg(person.state === "home" ? "mdiHomeAccount" : "mdiAccountArrowRight")}${esc(userName || "You")} · ${esc(presence)}</span>` : ""}
          </div>
        </div>
        ${
          weather
            ? `<div class="weather">${svg(weather.icon)}<div><div class="temp">${weather.temp === null ? "—" : `${Math.round(weather.temp)}°`}</div><div class="cond">${esc(weather.label)}</div>
               ${weather.hi !== null ? `<div class="hl">H ${Math.round(weather.hi)}°${weather.lo !== null ? ` · L ${Math.round(weather.lo)}°` : ""}</div>` : ""}</div></div>`
            : ""
        }
      </header>`;

    const tileHtml = `<div class="tiles">${tiles
      .map((t) => {
        const attrs = t.go ? `data-action="nav" data-path="${esc(t.go)}"` : t.scroll ? `data-action="scroll" data-target="${t.scroll}"` : "";
        const tag = attrs ? "button" : "div";
        const lvl = t.level === "gold" ? "" : t.level;
        return `<${tag} class="tile ${lvl}" ${attrs}>
          <div class="tile-top"><div class="tic" ${t.level === "gold" ? 'style="background:linear-gradient(160deg,#fde68a,#d97706);color:#3b2604"' : ""}>${svg(t.icon)}</div><span class="tile-name">${esc(t.name)}</span>${attrs ? svg("mdiChevronRight").replace('class="ic"', 'class="ic tile-go"') : ""}</div>
          <div class="tile-state">${esc(t.state)}</div>
          ${t.sub ? `<div class="tile-sub">${esc(t.sub)}</div>` : ""}
        </${tag}>`;
      })
      .join("")}</div>`;

    const switches = `<section class="card a-lights">
      <div class="head"><span class="eyebrow">Lights &amp; switches</span><span class="muted">${esc(tiles[2].state)}</span></div>
      <div class="switches">${c.lights
        .map((l) => {
          const s = st[l.entity];
          const on = s?.state === "on";
          const ok = live(s);
          return `<button class="sw ${on ? "on" : ""}" data-action="toggle" data-entity="${esc(l.entity)}" aria-pressed="${on}" ${ok ? "" : "disabled"}>
            <div class="sic">${svg(SWITCH_ICONS.includes(l.icon) ? l.icon : "mdiLightbulb")}</div><div><b>${esc(l.name)}</b><span>${ok ? (on ? "On" : "Off") : "Unavailable"}</span></div></button>`;
        })
        .join("")}</div>
    </section>`;

    const now = Date.now();
    const soon = agenda.filter((x) => x.at > now && x.at - now < 7 * 864e5).sort((a, b) => a.at - b.at).slice(0, 7);
    const agendaHtml = `<section class="card a-agenda">
      <div class="head"><span class="eyebrow">Up next</span></div>
      ${
        soon.length
          ? `<div class="agenda">${soon
              .map((x) => {
                const inner = `<div class="aic">${svg(x.icon)}</div><div><b>${esc(x.title)}</b>${x.sub ? `<small>${esc(x.sub)}</small>` : ""}</div>
                  <div class="when">${esc(dayLabel(x.at))}${x.allDay ? "" : `<small>${esc(this._fmtTime(x.at))}</small>`}</div>`;
                return x.go ? `<button class="ag" data-action="nav" data-path="${esc(x.go)}">${inner}</button>` : `<div class="ag">${inner}</div>`;
              })
              .join("")}</div>`
          : `<div class="allgood muted">Nothing coming up.</div>`
      }
    </section>`;

    const shown = this._showAllAttn ? attn : attn.slice(0, 5);
    const attnHtml = `<section class="card a-attn">
      <div class="head"><span class="eyebrow">Needs attention</span>${attn.length ? `<span class="muted">${attn.length}</span>` : ""}</div>
      ${
        attn.length
          ? `<div class="items">${shown
              .map((i) => {
                const inner = `${svg(i.icon)}<div><b>${esc(i.title)}</b><span>${esc(i.text || "")}</span></div>${i.go ? svg("mdiChevronRight").replace('class="ic"', 'class="ic go"') : ""}`;
                return i.go ? `<button class="item ${i.level}" data-action="nav" data-path="${esc(i.go)}">${inner}</button>` : `<div class="item ${i.level}">${inner}</div>`;
              })
              .join("")}</div>
             ${attn.length > 5 ? `<button class="link" data-action="more-attn">${this._showAllAttn ? "Show fewer" : `Show all ${attn.length}`}</button>` : ""}`
          : `<div class="allgood">${svg("mdiCheckCircleOutline")} Nothing needs you right now.</div>`
      }
    </section>`;

    const html = `
      <style>${CSS}</style>
      <div class="app">
        ${header}
        ${tileHtml}
        <main class="grid ${urgent.length ? "urgent" : ""}">${switches}${agendaHtml}${attnHtml}</main>
        ${this._toast ? `<div class="toast" role="alert">${esc(this._toast)}</div>` : ""}
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
