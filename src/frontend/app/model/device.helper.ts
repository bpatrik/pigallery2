export class DeviceHelper {

  // Phones and tablets: the primary input is a finger, not a mouse or touchpad.
  static isTouchDevice(): boolean {
    return window.matchMedia('(pointer: coarse)').matches;
  }
}
