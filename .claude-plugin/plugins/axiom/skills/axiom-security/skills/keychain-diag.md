
# Keychain Diagnostics

Systematic troubleshooting for Security framework failures: uniqueness constraint violations, query mismatches, data protection timing, access group entitlements, disappearing items after updates, and Mac shim behavior differences.

## Overview

**Core Principle**: When keychain operations fail, the problem is usually:
1. **Uniqueness constraint mismatch** (errSecDuplicateItem) — 25%
2. **Query attribute confusion** (errSecItemNotFound) — 25%
3. **Data protection / background timing** (errSecInteractionNotAllowed) — 20%
4. **Access group / entitlement mismatch** (errSecMissingEntitlement) — 15%
5. **Mac shim behavior differences** — 10%
6. **Lost items after app update** (entitlement or App ID prefix change) — 5%

**Always dump existing items and compare attributes BEFORE changing keychain code.**

## Red Flags

Symptoms that indicate keychain-specific issues:

| Symptom | Likely Cause |
|---------|--------------|
| errSecDuplicateItem when query returned not found | Non-unique attributes in add query — uniqueness is per-class + primary key attributes, not per your full query |
| errSecItemNotFound but item was just added | Wrong `kSecClass`, erroneous attribute narrowing query, or access group mismatch |
| errSecInteractionNotAllowed in background | `kSecAttrAccessibleWhenUnlocked` (default) + device locked + background execution |
| errSecMissingEntitlement | Access group not listed in keychain-access-groups entitlement |
| errSecNoSuchAttr | Attribute not supported for item class (e.g. `kSecAttrApplicationTag` on `kSecClassGenericPassword`) |
| errSecAuthFailed on Mac | File-based keychain locked or timed out |
| Items gone after app update | Access group or entitlement changed between versions |
| Items gone after team change | App ID prefix changed — items keyed to old prefix are inaccessible |
| SecItemDelete deleted everything | `kSecMatchLimit` is irrelevant for delete — it deletes ALL matching items |
| Keychain works in simulator, fails on device | Simulator does not enforce data protection — device does |

## Anti-Rationalization

| Rationalization | Why It Fails | Time Cost |
|----------------|--------------|-----------|
| "The wrapper handles it" | Wrappers hide uniqueness constraints. When errSecDuplicateItem happens, you can't debug what you can't see. You end up reading the wrapper source. | 30+ min unwrapping the wrapper |
| "I'll just delete and re-add" | Loses item metadata, breaks iCloud Keychain sync state, and if the delete query is broader than intended, silently deletes other items too. | 1-2 hours debugging missing credentials |
| "UserDefaults is fine for this one token" | UserDefaults is unencrypted, backed up to iCloud, visible to MDM profiles, and readable via device backup extraction. One security audit catches it. | Hours migrating to keychain after rejection |
| "errSecItemNotFound means it's not there" | It means your query didn't match. The item may exist with different attributes than you're searching for. Dump all items to check. | 30-60 min rewriting add logic when the item already exists |
| "I'll fix the keychain code after launch" | Keychain bugs are silent data loss. Users lose credentials after an update, can't log in, and have no recovery path. You find out from 1-star reviews. | Days of emergency patches + user trust damage |

## Mandatory First Steps

Before changing keychain code, run these diagnostics:

### Step 1: Dump All Items of the Relevant Class

```swift
let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecMatchLimit as String: kSecMatchLimitAll,
    kSecReturnAttributes as String: true,
    kSecReturnRef as String: true
]
var result: AnyObject?
let status = SecItemCopyMatching(query as CFDictionary, &result)
if status == errSecSuccess, let items = result as? [[String: Any]] {
    for item in items {
        print(item)
    }
}
```

This reveals every item of that class your app can see — including ones you forgot about.

### Step 2: Compare Attributes Against Your Query

Check each attribute in your add/update/search query against the dump output. Common mismatches:
- `kSecAttrAccount` vs `kSecAttrService` — which one are you using for the key?
- `kSecAttrAccessGroup` — are you specifying one that differs from the default?
- Extra attributes narrowing the search (e.g. `kSecAttrLabel` you set on add but omit on search)

### Step 3: Check Accessibility Class vs Device Lock State

```swift
// In your dump, look for:
// kSecAttrAccessible: kSecAttrAccessibleWhenUnlocked  (default — fails when locked)
// kSecAttrAccessible: kSecAttrAccessibleAfterFirstUnlock  (survives background)
```

If the app accesses keychain in background (push notification handlers, background fetch), `WhenUnlocked` will fail on a locked device.

### Step 4: Verify Access Group Entitlements

```bash
codesign -d --entitlements - /path/to/YourApp.app 2>&1 | grep keychain-access-groups
```

The access group in your query must appear in this list. The default group is `$(AppIdentifierPrefix)$(CFBundleIdentifier)`.

## Decision Trees

### Tree 1: errSecDuplicateItem

```dot
digraph tree1 {
    "errSecDuplicateItem?" [shape=diamond];
    "Dump all items (Step 1)" [shape=box];
    "Item with same primary keys exists?" [shape=diamond];
    "Same kSecAttrAccount + kSecAttrService?" [shape=diamond];

    "Use SecItemUpdate" [shape=box, label="Use SecItemUpdate instead.\nQuery with primary key attrs only.\nPass new values in attributesToUpdate."];
    "Query-before-add" [shape=box, label="Search first, update if found:\nSecItemCopyMatching → exists?\n  yes → SecItemUpdate\n  no → SecItemAdd"];
    "Different account/service" [shape=box, label="Your add query matches an existing\nitem on primary key attributes.\nkSecClassGenericPassword uniqueness:\n  kSecAttrAccount + kSecAttrService\n  + kSecAttrAccessGroup"];
    "Check access group" [shape=box, label="Item exists in a different access\ngroup. Your search missed it but\nadd sees it. Specify kSecAttrAccessGroup\nexplicitly in both operations."];

    "errSecDuplicateItem?" -> "Dump all items (Step 1)";
    "Dump all items (Step 1)" -> "Item with same primary keys exists?" [label="inspect"];
    "Item with same primary keys exists?" -> "Same kSecAttrAccount + kSecAttrService?" [label="yes"];
    "Item with same primary keys exists?" -> "Check access group" [label="no visible match"];
    "Same kSecAttrAccount + kSecAttrService?" -> "Use SecItemUpdate" [label="yes, want to overwrite"];
    "Same kSecAttrAccount + kSecAttrService?" -> "Different account/service" [label="no, different values"];
    "Use SecItemUpdate" -> "Query-before-add" [label="prevent future duplicates"];
}
```

**Uniqueness constraints by class**:

| Class | Primary Key Attributes |
|-------|----------------------|
| kSecClassGenericPassword | kSecAttrAccount + kSecAttrService + kSecAttrAccessGroup |
| kSecClassInternetPassword | kSecAttrAccount + kSecAttrSecurityDomain + kSecAttrServer + kSecAttrProtocol + kSecAttrAuthenticationType + kSecAttrPort + kSecAttrPath |
| kSecClassCertificate | kSecAttrCertificateType + kSecAttrIssuer + kSecAttrSerialNumber |
| kSecClassKey | kSecAttrKeyClass + kSecAttrKeyType + kSecAttrApplicationLabel + kSecAttrApplicationTag + kSecAttrEffectiveKeySize |

### Tree 2: errSecItemNotFound

```dot
digraph tree2 {
    "errSecItemNotFound?" [shape=diamond];
    "Dump all items (Step 1)" [shape=box];
    "Any items returned?" [shape=diamond];
    "Correct kSecClass?" [shape=diamond];
    "Erroneous attribute?" [shape=diamond];

    "Class mismatch" [shape=box, label="Wrong kSecClass in query.\nGenericPassword vs InternetPassword\nis the most common confusion.\nKeys use kSecClassKey."];
    "Narrow query" [shape=box, label="Erroneous attribute narrows\nquery to match nothing.\nRemove attributes one at a time\nuntil item is found.\nCommon: kSecAttrLabel, kSecAttrType"];
    "Access group" [shape=box, label="Item exists in different\naccess group than query.\nCheck kSecAttrAccessGroup\nor omit it to use default."];
    "Data protection" [shape=box, label="Item exists but device is locked\nand item has WhenUnlocked accessibility.\nSee Tree 3."];
    "Not added yet" [shape=box, label="Item was never successfully added.\nCheck return value of SecItemAdd\n— was it errSecSuccess?"];

    "errSecItemNotFound?" -> "Dump all items (Step 1)";
    "Dump all items (Step 1)" -> "Any items returned?" [label="check"];
    "Any items returned?" -> "Not added yet" [label="no items at all"];
    "Any items returned?" -> "Correct kSecClass?" [label="yes, items exist"];
    "Correct kSecClass?" -> "Class mismatch" [label="no"];
    "Correct kSecClass?" -> "Erroneous attribute?" [label="yes"];
    "Erroneous attribute?" -> "Narrow query" [label="yes, extra attrs"];
    "Erroneous attribute?" -> "Access group" [label="no, attrs match"];
    "Access group" -> "Data protection" [label="access group matches too"];
}
```

### Tree 3: errSecInteractionNotAllowed

```dot
digraph tree3 {
    "errSecInteractionNotAllowed?" [shape=diamond];
    "Background execution?" [shape=diamond];
    "Device locked?" [shape=diamond];
    "Check accessibility" [shape=diamond];

    "Change accessibility" [shape=box, label="Migrate item to\nkSecAttrAccessibleAfterFirstUnlock\nor AfterFirstUnlockThisDeviceOnly.\nRequires delete + re-add."];
    "Timing issue" [shape=box, label="App launched in background\nbefore first unlock after reboot.\nDefer keychain access until\nUIApplication.protectedDataDidBecomeAvailable"];
    "Delete trap" [shape=octagon, label="DANGER: Do NOT delete and re-add\njust to change accessibility.\nIf device is locked, the delete\nwill succeed but the add will FAIL\n— you lose the credential."];
    "Not data protection" [shape=box, label="On Mac: file-based keychain\nmay be locked. Check\nsecurity unlock-keychain.\nOr keychain requires user\ninteraction (SecAccessControl)."];
    "Check SecAccessControl" [shape=box, label="If using biometric protection\n(SecAccessControlCreateWithFlags),\nbackground access is impossible.\nStore a separate non-biometric\ncopy for background use."];

    "errSecInteractionNotAllowed?" -> "Background execution?" [label="check context"];
    "Background execution?" -> "Device locked?" [label="yes"];
    "Background execution?" -> "Not data protection" [label="no, foreground"];
    "Device locked?" -> "Check accessibility" [label="yes"];
    "Device locked?" -> "Check SecAccessControl" [label="no, unlocked but still fails"];
    "Check accessibility" -> "Timing issue" [label="WhenUnlocked + after reboot"];
    "Check accessibility" -> "Change accessibility" [label="WhenUnlocked + normal lock"];
    "Change accessibility" -> "Delete trap" [label="WARNING"];
}
```

### Tree 4: errSecMissingEntitlement

```dot
digraph tree4 {
    "errSecMissingEntitlement?" [shape=diamond];
    "Using explicit access group?" [shape=diamond];
    "Check entitlements (Step 4)" [shape=box];
    "Group in entitlements?" [shape=diamond];

    "Add to entitlements" [shape=box, label="Xcode > Target >\nSigning & Capabilities >\nKeychain Sharing >\nAdd access group"];
    "Prefix mismatch" [shape=box, label="Access group must use\nApp ID prefix (Team ID or\nApp ID prefix from portal).\n$(AppIdentifierPrefix)com.your.group\nNOT just com.your.group"];
    "Shared group config" [shape=box, label="For shared keychain between apps:\n1. Same Team ID\n2. Same access group string\n3. Both apps list group in\n   Keychain Sharing capability"];
    "Default group" [shape=box, label="If not specifying access group,\ndefault is AppIdentifierPrefix +\nbundle ID. Verify your app's\nprefix hasn't changed."];

    "errSecMissingEntitlement?" -> "Using explicit access group?" [label="check query"];
    "Using explicit access group?" -> "Check entitlements (Step 4)" [label="yes"];
    "Using explicit access group?" -> "Default group" [label="no"];
    "Check entitlements (Step 4)" -> "Group in entitlements?" [label="inspect"];
    "Group in entitlements?" -> "Prefix mismatch" [label="no, group missing"];
    "Group in entitlements?" -> "Shared group config" [label="yes but still fails"];
    "Prefix mismatch" -> "Add to entitlements" [label="fix"];
}
```

### Tree 5: Lost Keychain Items After App Update

```dot
digraph tree5 {
    "Items gone after update?" [shape=diamond];
    "Access group changed?" [shape=diamond];
    "App ID prefix changed?" [shape=diamond];
    "Entitlements file changed?" [shape=diamond];

    "Restore access group" [shape=box, label="Add the OLD access group back\nto Keychain Sharing entitlement.\nItems are keyed to the group\nthey were created with."];
    "Prefix migration" [shape=box, label="App ID prefix change means\nnew items are under new prefix.\nOld items are under old prefix.\nAdd both prefixes to entitlements\nor migrate items at first launch."];
    "Entitlement restore" [shape=box, label="If Keychain Sharing was removed,\nthe default access group changed.\nRe-add Keychain Sharing with\nthe original group name."];
    "Query change" [shape=box, label="Check if the query attributes\nchanged between versions.\nDump items (Step 1) to verify\nitems still exist under old attrs."];

    "Items gone after update?" -> "Access group changed?" [label="check entitlements diff"];
    "Access group changed?" -> "Restore access group" [label="yes"];
    "Access group changed?" -> "App ID prefix changed?" [label="no"];
    "App ID prefix changed?" -> "Prefix migration" [label="yes, team transfer"];
    "App ID prefix changed?" -> "Entitlements file changed?" [label="no"];
    "Entitlements file changed?" -> "Entitlement restore" [label="yes"];
    "Entitlements file changed?" -> "Query change" [label="no, entitlements identical"];
}
```

### Tree 6: Mac-Specific Issues

```dot
digraph tree6 {
    "Mac keychain issue?" [shape=diamond];
    "Catalyst or native?" [shape=diamond];
    "File-based keychain?" [shape=diamond];

    "Shim behavior" [shape=box, label="Mac Catalyst uses iOS-style\ndata-protection keychain by default.\nkSecUseDataProtectionKeychain = true\nis automatic on Catalyst.\nFile-based keychain quirks don't apply."];
    "Native Mac" [shape=box, label="Native macOS apps default to\nfile-based keychain unless you set\nkSecUseDataProtectionKeychain = true.\nFile-based has different:\n- kSecMatchLimit defaults\n- Locking behavior\n- Access control prompts"];
    "Match limit" [shape=box, label="File-based keychain default:\nkSecMatchLimit = kSecMatchLimitAll\nData-protection keychain default:\nkSecMatchLimit = kSecMatchLimitOne\nAlways set explicitly."];
    "Lock timeout" [shape=box, label="File-based keychain locks after\ntimeout (default: sleep + 5 min idle).\nerrSecAuthFailed = locked keychain.\nsecurity unlock-keychain to test."];
    "Use data protection" [shape=box, label="For cross-platform code,\nset kSecUseDataProtectionKeychain = true\non macOS. This gives iOS-identical\nbehavior on macOS 10.15+."];

    "Mac keychain issue?" -> "Catalyst or native?" [label="check target"];
    "Catalyst or native?" -> "Shim behavior" [label="Catalyst"];
    "Catalyst or native?" -> "File-based keychain?" [label="native macOS"];
    "File-based keychain?" -> "Match limit" [label="unexpected result count"];
    "File-based keychain?" -> "Lock timeout" [label="errSecAuthFailed"];
    "File-based keychain?" -> "Use data protection" [label="want iOS-identical behavior"];
    "Shim behavior" -> "Native Mac" [label="opted out of shim"];
}
```

### Tree 7: errSecNoSuchAttr

```dot
digraph tree7 {
    "errSecNoSuchAttr?" [shape=diamond];
    "Check attr vs class" [shape=box, label="Not all attributes work\nwith all item classes.\nDump item to see which\nattributes it actually has."];
    "Common mistakes" [shape=diamond];

    "Tag on password" [shape=box, label="kSecAttrApplicationTag is for\nkSecClassKey only.\nFor passwords, use\nkSecAttrAccount or kSecAttrService."];
    "Label mismatch" [shape=box, label="kSecAttrLabel behavior differs:\n- Passwords: free-form string\n- Keys: computed from key data\n- Certs: computed from subject\nSetting it may be silently ignored."];
    "Description on key" [shape=box, label="kSecAttrDescription is for\nkSecClassGenericPassword and\nkSecClassInternetPassword only.\nNot available on keys or certs."];

    "errSecNoSuchAttr?" -> "Check attr vs class" [label="first"];
    "Check attr vs class" -> "Common mistakes" [label="identify"];
    "Common mistakes" -> "Tag on password" [label="kSecAttrApplicationTag + password"];
    "Common mistakes" -> "Label mismatch" [label="kSecAttrLabel unexpected behavior"];
    "Common mistakes" -> "Description on key" [label="kSecAttrDescription + key/cert"];
}
```

## Quick Reference Table

| Symptom | Check | Fix |
|---------|-------|-----|
| errSecDuplicateItem | Dump items (Step 1), compare primary key attrs | Use SecItemUpdate or query-before-add pattern |
| errSecItemNotFound | Dump items, verify kSecClass + attributes match | Remove erroneous attributes, fix class |
| errSecInteractionNotAllowed in background | Check kSecAttrAccessible value | Migrate to AfterFirstUnlock (delete + re-add while unlocked) |
| errSecInteractionNotAllowed after reboot | Check if first unlock happened | Defer access until protectedDataDidBecomeAvailable |
| errSecMissingEntitlement | `codesign -d --entitlements -` for access groups | Add group to Keychain Sharing capability |
| errSecNoSuchAttr | Check attribute compatibility with item class | Use correct attribute for the class |
| errSecAuthFailed on Mac | Check if file-based keychain is locked | `security unlock-keychain` or use data-protection keychain |
| Items gone after update | Diff entitlements between versions | Restore old access group, migrate items |
| Items gone after team change | Check App ID prefix change | Add both prefixes to entitlements |
| Delete removed too many items | Review delete query specificity | Always specify all primary key attrs in delete query |
| Works in simulator, fails on device | Check accessibility class | Simulator ignores data protection — test on device |
| Inconsistent Mac vs iOS behavior | Check kSecUseDataProtectionKeychain | Set to true for consistent cross-platform behavior |
| Query returns wrong item | Check kSecMatchLimit | Always set explicitly — defaults differ by keychain type |
| Biometric item fails in background | Check SecAccessControl flags | Store separate non-biometric copy for background |
| SecItemAdd returns errSecSuccess but search fails | Check if access groups differ between add and search | Specify kSecAttrAccessGroup explicitly in both |

## Pressure Scenarios

### Scenario 1: "Users can't log in after the update — just clear and re-store the token"

**Context**: Version 2.1 shipped with a Keychain Sharing entitlement change. Users updating from 2.0 lose their auth tokens. Support tickets are flooding in.

**Pressure**: "Just delete the old item and store a new one on first launch."

**Reality**: The old item is inaccessible because the access group changed — SecItemDelete can't find it either. The "delete and re-add" approach silently does nothing. Meanwhile, the real fix is restoring the old access group in entitlements so existing items are readable again, then migrating to the new group.

**Correct action**: Add the old access group back to the Keychain Sharing entitlement. On first launch, read from old group, write to new group, delete from old group. Ship as 2.1.1.

**Push-back template**: "The delete won't work either — the old items are under the old access group that we can no longer read. We need to add the old access group back to our entitlements so we can read and migrate those items. This is a 30-minute fix, not a redesign."

### Scenario 2: "errSecInteractionNotAllowed in push handler — just change to AfterFirstUnlock"

**Context**: Background push notification handler reads an auth token from keychain to call an API. Fails with errSecInteractionNotAllowed when device is locked.

**Pressure**: "Just change the accessibility to AfterFirstUnlock. Quick fix."

**Reality**: Changing accessibility requires deleting the old item and adding a new one with the new accessibility class. If you do this in the push handler while the device is locked, the delete succeeds (it doesn't read data) but the add fails (AfterFirstUnlock still requires first unlock, and if the device just rebooted, first unlock hasn't happened). You just deleted the user's credential.

**Correct action**: Change accessibility in foreground code (app launch, `protectedDataDidBecomeAvailable`). Never migrate keychain items in background execution paths.

**Push-back template**: "We can't change accessibility in the push handler — the delete works but the re-add can fail if the device rebooted without unlocking. We need to migrate in the foreground on next app launch, and handle the push handler failure gracefully until then."

### Scenario 3: "The keychain wrapper handles all this — just use it"

**Context**: Team uses a third-party keychain wrapper (KeychainAccess, Valet, etc.). errSecDuplicateItem keeps happening despite the wrapper's "upsert" method.

**Pressure**: "The wrapper documentation says it handles duplicates. Must be a bug in the wrapper."

**Reality**: The wrapper's upsert does query-then-add or query-then-update. But if your query attributes don't match the uniqueness constraints of the item class, the search returns not-found while the add hits the existing item's primary key. The wrapper can't fix a query that uses the wrong attributes. You need to understand what makes items unique and ensure your wrapper configuration matches.

**Correct action**: Dump all items (Step 1) to see what exists. Compare the wrapper's query attributes against the item class uniqueness constraints table. Fix the wrapper configuration to query on primary key attributes.

**Push-back template**: "The wrapper works correctly — it's our configuration that doesn't match the keychain's uniqueness constraints. Let me dump the existing items and compare against our query. This is a 10-minute diagnosis."

## Checklist

Before declaring a keychain issue fixed:

- [ ] Dumped all items of relevant class — understand what exists
- [ ] Verified kSecClass matches the item type (GenericPassword vs InternetPassword vs Key)
- [ ] Checked primary key attributes for uniqueness constraints
- [ ] Confirmed kSecAttrAccessible suits the execution context (foreground vs background)
- [ ] Verified access group in entitlements matches query
- [ ] Tested on device (not just simulator — simulator ignores data protection)
- [ ] Tested after device reboot + lock for background scenarios
- [ ] If migrating accessibility: migration runs in foreground only, never background
- [ ] If sharing between apps: both apps have same access group in Keychain Sharing

## Resources

**Docs**: /security/keychain_services, /security/keychain_services/keychain_items, /security/errSecDuplicateItem, /security/errSecItemNotFound, /security/errSecInteractionNotAllowed

**Reference**: Quinn "The Eskimo" — SecItem Pitfalls and Best Practices (Apple Developer Forums), Keychain Items Fundamentals (Apple TN3137)

**Skills**: axiom-keychain, axiom-keychain-ref
