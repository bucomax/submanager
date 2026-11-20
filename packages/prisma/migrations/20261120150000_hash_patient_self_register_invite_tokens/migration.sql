-- Token do convite de auto-cadastro passa a ser guardado como sha256 hex (o valor cru só existe no link/QR).
-- Converte os convites já emitidos para que links pendentes continuem válidos após o deploy.
-- Mesmo algoritmo do app: sha256(utf8) em hex (ver 20261117200000).
UPDATE "PatientSelfRegisterInvite" SET "token" = encode(sha256(convert_to("token", 'UTF8')), 'hex');
