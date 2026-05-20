/**
 * TypeScript declarations for bcryptjs
 * Pure JavaScript bcrypt implementation — zero native dependencies.
 *
 * bcryptjs is a CommonJS module that exports a single object with hash/compare/genSalt methods.
 * This declaration supports:
 *   import bcrypt from 'bcryptjs'           (default import)
 *   const bcrypt = require('bcryptjs')      (CommonJS)
 *   const bcrypt = await import('bcryptjs') (dynamic import)
 */
declare module 'bcryptjs' {
  const bcrypt: {
    /**
     * Asynchronously generates a hash for the given string.
     * @param s - String to hash
     * @param salt - Salt length (number) or salt string to use
     */
    hash(s: string, salt: number | string): Promise<string>

    /**
     * Synchronously generates a hash for the given string.
     */
    hashSync(s: string, salt: number | string): string

    /**
     * Asynchronously compares a string against a hash.
     * @param s - String to compare
     * @param hash - Hash to test against
     */
    compare(s: string, hash: string): Promise<boolean>

    /**
     * Synchronously compares a string against a hash.
     */
    compareSync(s: string, hash: string): boolean

    /**
     * Asynchronously generates a salt.
     * @param rounds - Number of rounds (default: 10)
     */
    genSalt(rounds?: number): Promise<string>

    /**
     * Synchronously generates a salt.
     */
    genSaltSync(rounds?: number): string

    /**
     * Gets the number of rounds used to encrypt the specified hash.
     */
    getRounds(hash: string): number

    /**
     * Gets the salt portion from a hash.
     */
    getSalt(hash: string): string
  }

  export = bcrypt
}
